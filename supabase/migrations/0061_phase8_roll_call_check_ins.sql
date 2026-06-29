-- Phase 8 completion: roll call → check_ins fallback, abandon guard.

create or replace function public.roll_call_sync_check_ins(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_late_counts boolean := true;
  v_inserted integer := 0;
begin
  if p_class_id is null then
    return 0;
  end if;

  select coalesce(late_counts_as_present, true)
    into v_late_counts
  from public.roll_call_settings
  where id = 1;

  insert into public.check_ins (
    user_id,
    class_id,
    checked_in_at,
    method,
    source,
    signed_in,
    missed,
    late_cancelled
  )
  select
    csa.user_id,
    p_class_id,
    coalesce(csa.marked_at, now()),
    'coach_roster',
    'supabase',
    true,
    false,
    false
  from public.class_session_attendance csa
  where csa.class_id = p_class_id
    and csa.user_id is not null
    and (
      csa.status = 'present'
      or (csa.status = 'late' and v_late_counts)
    )
    and not exists (
      select 1
      from public.check_ins ci
      where ci.user_id = csa.user_id
        and ci.class_id = p_class_id
        and ci.method = 'coach_roster'
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.roll_call_sync_check_ins(uuid) from public;
grant execute on function public.roll_call_sync_check_ins(uuid) to authenticated;

create or replace function public.complete_roll_call(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.roll_call_sessions%rowtype;
  v_synced integer := 0;
begin
  perform public.require_roll_call_coach();

  if p_session_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select * into v_session
  from public.roll_call_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.assert_coach_class_access(v_session.class_id);

  if v_session.status = 'completed' then
    return jsonb_build_object(
      'session', public.roll_call_session_to_json(v_session),
      'summary', public.roll_call_summary_for_class(v_session.class_id),
      'checkInsSynced', 0
    );
  end if;

  update public.roll_call_sessions
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  v_synced := public.roll_call_sync_check_ins(v_session.class_id);

  return jsonb_build_object(
    'session', public.roll_call_session_to_json(v_session),
    'summary', public.roll_call_summary_for_class(v_session.class_id),
    'checkInsSynced', v_synced
  );
end;
$$;

create or replace function public.abandon_roll_call(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.roll_call_sessions%rowtype;
begin
  perform public.require_roll_call_coach();

  if p_session_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select * into v_session
  from public.roll_call_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.assert_coach_class_access(v_session.class_id);

  if v_session.status = 'completed' then
    raise exception using message = 'ROLL_CALL_COMPLETED', errcode = 'P0001';
  end if;

  if v_session.status <> 'in_progress' then
    raise exception using message = 'NO_ACTIVE_SESSION', errcode = 'P0001';
  end if;

  delete from public.class_session_attendance
  where class_id = v_session.class_id
    and roll_call_session_id = v_session.id;

  delete from public.roll_call_sessions
  where id = p_session_id;

  return jsonb_build_object('classId', v_session.class_id);
end;
$$;
