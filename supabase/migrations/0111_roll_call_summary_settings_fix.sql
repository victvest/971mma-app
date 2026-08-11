-- Roll call summary must never be null — missing roll_call_settings broke get_roll_call_state.

insert into public.roll_call_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.roll_call_summary_for_class(p_class_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with marks as (
    select status, method, user_id
    from public.class_session_attendance
    where class_id = p_class_id
  ),
  counts as (
    select
      count(*) filter (where status = 'present')::int as present,
      count(*) filter (where status = 'late')::int as late,
      count(*) filter (where status = 'absent')::int as absent,
      count(*) filter (where status = 'left_early')::int as left_early,
      count(*) filter (where method = 'walk_in')::int as walk_ins,
      count(*) filter (where status = 'guest')::int as guests,
      count(*) filter (where user_id is null)::int as not_on_app,
      count(*)::int as total_marked
    from marks
  )
  select jsonb_build_object(
    'present', c.present,
    'late', c.late,
    'absent', c.absent,
    'leftEarly', c.left_early,
    'walkIns', c.walk_ins,
    'guests', c.guests,
    'notOnApp', c.not_on_app,
    'sessionCount',
      c.present
      + case
          when coalesce(
            (select s.late_counts_as_present from public.roll_call_settings s where s.id = 1),
            true
          )
          then c.late
          else 0
        end,
    'totalMarked', c.total_marked,
    'totalOnDeck', c.total_marked
  )
  from counts c;
$$;

create or replace function public.roll_call_settings_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autoFacilityCheckinOnPresent', coalesce(s.auto_facility_checkin_on_present, false),
    'lateCountsAsPresent', coalesce(s.late_counts_as_present, true),
    'notifyMemberOnPresent', coalesce(s.notify_member_on_present, true),
    'notifyMemberOnAbsent', coalesce(s.notify_member_on_absent, false)
  )
  from public.roll_call_settings s
  where s.id = 1
  union all
  select jsonb_build_object(
    'autoFacilityCheckinOnPresent', false,
    'lateCountsAsPresent', true,
    'notifyMemberOnPresent', true,
    'notifyMemberOnAbsent', false
  )
  where not exists (select 1 from public.roll_call_settings where id = 1)
  limit 1;
$$;

-- Fresh roll call: drop marks orphaned by deleted sessions so coaches are not skipped to summary.
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
  perform public.require_roll_call_coach_for_class(p_class_id);

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

  delete from public.class_session_attendance csa
  where csa.class_id = p_class_id
    and csa.roll_call_session_id is not null
    and not exists (
      select 1
      from public.roll_call_sessions s
      where s.id = csa.roll_call_session_id
    );

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
