-- Fix roll_call_active_session: composite SQL functions return one null row when empty.

drop function if exists public.roll_call_active_session(uuid);

create or replace function public.roll_call_active_session(p_class_id uuid)
returns setof public.roll_call_sessions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.roll_call_sessions s
  where s.class_id = p_class_id
    and s.status = 'in_progress'
  order by s.started_at desc nulls last, s.created_at desc
  limit 1;
$$;

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

create or replace function public.record_roll_call_mark(
  p_class_id uuid,
  p_user_id uuid default null,
  p_mindbody_client_id text default null,
  p_status text default null,
  p_method text default 'roll_call',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.roll_call_sessions%rowtype;
  v_user_id uuid := p_user_id;
  v_mindbody_client_id text := nullif(trim(p_mindbody_client_id), '');
  v_status text := nullif(trim(p_status), '');
  v_method text := coalesce(nullif(trim(p_method), ''), 'roll_call');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_row public.class_session_attendance%rowtype;
begin
  perform public.require_roll_call_coach();

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_user_id is null and v_mindbody_client_id is null then
    raise exception using message = 'MEMBER_REF_REQUIRED', errcode = 'P0001';
  end if;

  if v_status is null or v_status not in ('present', 'absent', 'late', 'left_early', 'guest') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  if v_method not in ('roll_call', 'walk_in', 'qr_scan', 'roster_list') then
    raise exception using message = 'INVALID_METHOD', errcode = 'P0001';
  end if;

  if not exists (select 1 from public.classes where id = p_class_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_session
  from public.roll_call_active_session(p_class_id)
  limit 1;

  if not found or v_session.id is null then
    raise exception using message = 'NO_ACTIVE_SESSION', errcode = 'P0001';
  end if;

  if v_user_id is not null and v_mindbody_client_id is null then
    select ml.mindbody_client_id into v_mindbody_client_id
    from public.mindbody_links ml
    where ml.user_id = v_user_id;
  elsif v_user_id is null and v_mindbody_client_id is not null then
    select ml.user_id into v_user_id
    from public.mindbody_links ml
    where ml.mindbody_client_id = v_mindbody_client_id;
  end if;

  if v_user_id is not null then
    insert into public.class_session_attendance (
      class_id,
      user_id,
      mindbody_client_id,
      status,
      method,
      marked_by,
      marked_at,
      roll_call_session_id,
      metadata
    )
    values (
      p_class_id,
      v_user_id,
      v_mindbody_client_id,
      v_status,
      v_method,
      auth.uid(),
      now(),
      v_session.id,
      v_metadata
    )
    on conflict (class_id, user_id) where user_id is not null
    do update set
      status = excluded.status,
      method = excluded.method,
      marked_by = auth.uid(),
      marked_at = now(),
      roll_call_session_id = excluded.roll_call_session_id,
      metadata = coalesce(class_session_attendance.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now()
    returning * into v_row;
  else
    insert into public.class_session_attendance (
      class_id,
      user_id,
      mindbody_client_id,
      status,
      method,
      marked_by,
      marked_at,
      roll_call_session_id,
      metadata
    )
    values (
      p_class_id,
      null,
      v_mindbody_client_id,
      v_status,
      v_method,
      auth.uid(),
      now(),
      v_session.id,
      v_metadata
    )
    on conflict (class_id, mindbody_client_id) where mindbody_client_id is not null
    do update set
      status = excluded.status,
      method = excluded.method,
      marked_by = auth.uid(),
      marked_at = now(),
      roll_call_session_id = excluded.roll_call_session_id,
      metadata = coalesce(class_session_attendance.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now()
    returning * into v_row;
  end if;

  update public.roll_call_sessions
  set deck_cursor = deck_cursor + 1,
      updated_at = now()
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'mark', public.roll_call_mark_to_json(v_row),
    'session', public.roll_call_session_to_json(v_session)
  );
end;
$$;

revoke execute on function public.roll_call_active_session(uuid) from public, anon;
grant execute on function public.roll_call_active_session(uuid) to authenticated;
