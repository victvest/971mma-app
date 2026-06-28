-- TINDER Phase 3: Roll call RPCs (security definer) + academy settings singleton.

-- ── settings (pilot defaults) ─────────────────────────────────────────────────

create table if not exists public.roll_call_settings (
  id int primary key default 1 check (id = 1),
  auto_facility_checkin_on_present boolean not null default false,
  late_counts_as_present boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.roll_call_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.roll_call_settings enable row level security;

drop policy if exists "roll_call_settings select coach" on public.roll_call_settings;
create policy "roll_call_settings select coach"
  on public.roll_call_settings for select
  to authenticated
  using (public.is_coach_or_admin());

-- ── helpers ─────────────────────────────────────────────────────────────────

create or replace function public.require_roll_call_coach()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.roll_call_settings_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autoFacilityCheckinOnPresent', s.auto_facility_checkin_on_present,
    'lateCountsAsPresent', s.late_counts_as_present
  )
  from public.roll_call_settings s
  where s.id = 1;
$$;

create or replace function public.roll_call_session_to_json(p_session public.roll_call_sessions)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_session.id,
    'classId', p_session.class_id,
    'coachId', p_session.coach_id,
    'status', p_session.status,
    'deckCursor', p_session.deck_cursor,
    'startedAt', p_session.started_at,
    'completedAt', p_session.completed_at
  );
$$;

create or replace function public.roll_call_mark_to_json(p_row public.class_session_attendance)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'status', p_row.status,
    'method', p_row.method,
    'markedAt', p_row.marked_at,
    'markedBy', p_row.marked_by,
    'metadata', p_row.metadata
  );
$$;

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
  settings as (
    select late_counts_as_present
    from public.roll_call_settings
    where id = 1
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
    'sessionCount', c.present + case when s.late_counts_as_present then c.late else 0 end,
    'totalMarked', c.total_marked,
    'totalOnDeck', c.total_marked
  )
  from counts c
  cross join settings s;
$$;

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

-- ── start_roll_call ───────────────────────────────────────────────────────────

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

-- ── record_roll_call_mark ─────────────────────────────────────────────────────

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

-- ── complete_roll_call ────────────────────────────────────────────────────────

create or replace function public.complete_roll_call(p_session_id uuid)
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
    return jsonb_build_object(
      'session', public.roll_call_session_to_json(v_session),
      'summary', public.roll_call_summary_for_class(v_session.class_id)
    );
  end if;

  update public.roll_call_sessions
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  return jsonb_build_object(
    'session', public.roll_call_session_to_json(v_session),
    'summary', public.roll_call_summary_for_class(v_session.class_id)
  );
end;
$$;

-- ── get_roll_call_state (roster merge stub — Phase 4 wires Mindbody) ──────────

create or replace function public.get_roll_call_state(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_session public.roll_call_sessions%rowtype;
  v_deck jsonb := '[]'::jsonb;
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

  select * into v_session
  from public.roll_call_sessions
  where class_id = p_class_id
  order by
    case status when 'in_progress' then 0 when 'completed' then 1 else 2 end,
    started_at desc nulls last,
    created_at desc
  limit 1;

  if not found then
    v_session := null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deckKey', coalesce(csa.user_id::text, 'mb:' || csa.mindbody_client_id),
        'displayName', coalesce(p.full_name, 'Member'),
        'avatarUrl', p.avatar_url,
        'beltRank', p.belt_rank,
        'beltStripes', coalesce(p.belt_stripes, 0),
        'userId', csa.user_id,
        'mindbodyClientId', coalesce(csa.mindbody_client_id, ''),
        'mark', public.roll_call_mark_to_json(csa),
        'isOnApp', csa.user_id is not null,
        'isBookedOnRoster', false,
        'hasFacilityCheckInToday', false,
        'isWalkIn', csa.method = 'walk_in',
        'isGuest', csa.status = 'guest',
        'presentedBy', csa.metadata ->> 'presented_by'
      )
      order by csa.marked_at asc
    ),
    '[]'::jsonb
  )
  into v_deck
  from public.class_session_attendance csa
  left join public.profiles p on p.id = csa.user_id
  where csa.class_id = p_class_id;

  return jsonb_build_object(
    'session', case when v_session.id is not null then public.roll_call_session_to_json(v_session) else null end,
    'classId', v_class.id,
    'classTitle', v_class.title,
    'startsAt', v_class.starts_at,
    'deck', v_deck,
    'summary', public.roll_call_summary_for_class(p_class_id),
    'rosterCachedAt', null,
    'config', public.roll_call_settings_json()
  );
end;
$$;

-- ── search_members_for_roll_call ──────────────────────────────────────────────

create or replace function public.search_members_for_roll_call(
  p_class_id uuid,
  p_query text,
  p_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_results jsonb;
begin
  perform public.require_roll_call_coach();

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if not exists (select 1 from public.classes where id = p_class_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_query is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(row_payload order by sort_name),
    '[]'::jsonb
  )
  into v_results
  from (
    select
      coalesce(p.full_name, 'Member') as sort_name,
      jsonb_build_object(
        'deckKey', p.id::text,
        'displayName', coalesce(p.full_name, 'Member'),
        'avatarUrl', p.avatar_url,
        'beltRank', p.belt_rank,
        'beltStripes', coalesce(p.belt_stripes, 0),
        'userId', p.id,
        'mindbodyClientId', ml.mindbody_client_id,
        'isOnApp', true,
        'alreadyOnDeck', exists (
          select 1
          from public.class_session_attendance csa
          where csa.class_id = p_class_id
            and csa.user_id = p.id
        )
      ) as row_payload
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    where p.role = 'member'
      and (
        p.full_name ilike '%' || v_query || '%'
        or u.email ilike '%' || v_query || '%'
        or ml.mindbody_client_id ilike '%' || v_query || '%'
      )
    order by sort_name
    limit v_limit
  ) ranked;

  return v_results;
end;
$$;

-- ── grants ────────────────────────────────────────────────────────────────────

revoke all on function public.require_roll_call_coach() from public;
revoke all on function public.roll_call_settings_json() from public;
revoke all on function public.roll_call_session_to_json(public.roll_call_sessions) from public;
revoke all on function public.roll_call_mark_to_json(public.class_session_attendance) from public;
revoke all on function public.roll_call_summary_for_class(uuid) from public;
revoke all on function public.roll_call_active_session(uuid) from public;

grant execute on function public.require_roll_call_coach() to authenticated;
grant execute on function public.roll_call_settings_json() to authenticated;
grant execute on function public.roll_call_session_to_json(public.roll_call_sessions) to authenticated;
grant execute on function public.roll_call_mark_to_json(public.class_session_attendance) to authenticated;
grant execute on function public.roll_call_summary_for_class(uuid) to authenticated;
grant execute on function public.roll_call_active_session(uuid) to authenticated;

revoke execute on function public.start_roll_call(uuid) from public, anon;
revoke execute on function public.record_roll_call_mark(uuid, uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.complete_roll_call(uuid) from public, anon;
revoke execute on function public.get_roll_call_state(uuid) from public, anon;
revoke execute on function public.search_members_for_roll_call(uuid, text, int) from public, anon;

grant execute on function public.start_roll_call(uuid) to authenticated;
grant execute on function public.record_roll_call_mark(uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.complete_roll_call(uuid) to authenticated;
grant execute on function public.get_roll_call_state(uuid) to authenticated;
grant execute on function public.search_members_for_roll_call(uuid, text, int) to authenticated;
