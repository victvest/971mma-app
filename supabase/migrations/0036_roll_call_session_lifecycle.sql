-- TINDER Phase 9 — session lifecycle: block restart after complete, abandon in-progress.

-- ── start_roll_call — reject when a completed session already exists ──────────

create or replace function public.start_roll_call(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_existing public.roll_call_sessions%rowtype;
  v_session public.roll_call_sessions%rowtype;
begin
  perform public.require_roll_call_coach();

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select * into v_class
  from public.classes
  where id = p_class_id;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_class.is_cancelled then
    raise exception using message = 'CLASS_CANCELLED', errcode = 'P0001';
  end if;

  select * into v_existing
  from public.roll_call_active_session(p_class_id)
  limit 1;

  if found and v_existing.id is not null then
    return jsonb_build_object(
      'session', public.roll_call_session_to_json(v_existing),
      'resumed', true
    );
  end if;

  if exists (
    select 1
    from public.roll_call_sessions s
    where s.class_id = p_class_id
      and s.status = 'completed'
  ) then
    raise exception using message = 'ROLL_CALL_COMPLETED', errcode = 'P0001';
  end if;

  insert into public.roll_call_sessions (
    class_id,
    coach_id,
    status,
    deck_cursor,
    started_at
  )
  values (
    p_class_id,
    auth.uid(),
    'in_progress',
    0,
    now()
  )
  returning * into v_session;

  return jsonb_build_object(
    'session', public.roll_call_session_to_json(v_session),
    'resumed', false
  );
end;
$$;

-- ── abandon_roll_call — discard in-progress session + its marks ───────────────

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

revoke execute on function public.abandon_roll_call(uuid) from public, anon;
grant execute on function public.abandon_roll_call(uuid) to authenticated;
