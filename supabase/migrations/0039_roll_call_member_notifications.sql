-- TINDER Phase 16 — member in-app notifications + guardian read on class attendance.

alter table public.roll_call_settings
  add column if not exists notify_member_on_present boolean not null default true,
  add column if not exists notify_member_on_absent boolean not null default false;

create or replace function public.roll_call_settings_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autoFacilityCheckinOnPresent', s.auto_facility_checkin_on_present,
    'lateCountsAsPresent', s.late_counts_as_present,
    'notifyMemberOnPresent', s.notify_member_on_present,
    'notifyMemberOnAbsent', s.notify_member_on_absent
  )
  from public.roll_call_settings s
  where s.id = 1;
$$;

-- Guardians may read trainee class attendance (same pattern as check_ins).
drop policy if exists "class_session_attendance select own" on public.class_session_attendance;
create policy "class_session_attendance select own"
  on public.class_session_attendance for select
  to authenticated
  using (public.can_read_member_data(user_id));

create or replace function public.roll_call_member_notification_copy(
  p_status text,
  p_class_title text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_title text := coalesce(nullif(trim(p_class_title), ''), 'Class');
begin
  case p_status
    when 'present' then
      return jsonb_build_object(
        'title', 'Marked present',
        'body', format('You were marked present for %s.', v_title)
      );
    when 'late' then
      return jsonb_build_object(
        'title', 'Marked present (late)',
        'body', format('You were marked present (late) for %s.', v_title)
      );
    when 'absent' then
      return jsonb_build_object(
        'title', 'Marked absent',
        'body', format('You were marked absent for %s.', v_title)
      );
    else
      return null;
  end case;
end;
$$;

create or replace function public.roll_call_notify_member(
  p_user_id uuid,
  p_class_id uuid,
  p_status text,
  p_marked_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_present boolean;
  v_notify_absent boolean;
  v_class_title text;
  v_copy jsonb;
begin
  if p_user_id is null then
    return;
  end if;

  if p_status not in ('present', 'late', 'absent') then
    return;
  end if;

  select notify_member_on_present, notify_member_on_absent
  into v_notify_present, v_notify_absent
  from public.roll_call_settings
  where id = 1;

  if p_status in ('present', 'late') and not coalesce(v_notify_present, true) then
    return;
  end if;

  if p_status = 'absent' and not coalesce(v_notify_absent, false) then
    return;
  end if;

  select c.title into v_class_title
  from public.classes c
  where c.id = p_class_id;

  if not found then
    return;
  end if;

  v_copy := public.roll_call_member_notification_copy(p_status, v_class_title);
  if v_copy is null then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user_id,
    'class_attendance',
    jsonb_build_object(
      'title', v_copy->>'title',
      'body', v_copy->>'body',
      'classId', p_class_id,
      'status', p_status,
      'markedAt', p_marked_at
    )
  );
end;
$$;

revoke execute on function public.roll_call_notify_member(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.roll_call_notify_member(uuid, uuid, text, timestamptz) to authenticated;

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
  from public.roll_call_session_for_marks(p_class_id)
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
    on conflict (class_id, mindbody_client_id) where mindbody_client_id is not null and user_id is null
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

  perform public.roll_call_notify_member(v_user_id, p_class_id, v_status, v_row.marked_at);

  return jsonb_build_object(
    'mark', public.roll_call_mark_to_json(v_row),
    'session', public.roll_call_session_to_json(v_session)
  );
end;
$$;
