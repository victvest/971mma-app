-- Phase 8: Coach mobile workflows — discipline-scoped access, post-class notes, dashboard filtering.

-- ── coach_member_notes ────────────────────────────────────────────────────────

create table if not exists public.coach_member_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  visibility text not null default 'coach_admin' check (visibility in ('coach_admin', 'member_visible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_coach_member_notes_class
  on public.coach_member_notes(class_id)
  where deleted_at is null;

create index if not exists idx_coach_member_notes_member
  on public.coach_member_notes(user_id)
  where deleted_at is null;

-- ── helpers (must exist before RLS policies) ──────────────────────────────────

create or replace function public.coach_id_for_user(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.coaches c
  where c.user_id = coalesce(p_user_id, auth.uid())
    and c.active = true
    and c.deleted_at is null
  limit 1;
$$;

revoke all on function public.coach_id_for_user(uuid) from public;
grant execute on function public.coach_id_for_user(uuid) to authenticated;

create or replace function public.coach_teaches_class(p_coach_id uuid, p_class public.classes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coaches c
    where c.id = p_coach_id
      and (
        (
          c.mindbody_staff_id is not null
          and p_class.staff_mindbody_id = c.mindbody_staff_id
        )
        or (
          c.mindbody_staff_id is null
          and p_class.coach_name is not null
          and lower(trim(p_class.coach_name)) = lower(trim(c.name))
        )
        or p_class.coach_id = c.id
      )
  );
$$;

revoke all on function public.coach_teaches_class(uuid, public.classes) from public;
grant execute on function public.coach_teaches_class(uuid, public.classes) to authenticated;

create or replace function public.coach_has_discipline_access(p_coach_id uuid, p_discipline_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_discipline_id is null
    or not exists (
      select 1 from public.coach_disciplines cd where cd.coach_id = p_coach_id
    )
    or exists (
      select 1
      from public.coach_disciplines cd
      where cd.coach_id = p_coach_id
        and cd.discipline_id = p_discipline_id
    );
$$;

revoke all on function public.coach_has_discipline_access(uuid, uuid) from public;
grant execute on function public.coach_has_discipline_access(uuid, uuid) to authenticated;

create or replace function public.assert_coach_class_access(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_coach_id uuid;
begin
  if exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    return;
  end if;

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if not found then
    raise exception 'Class not found.' using errcode = 'P0001';
  end if;

  v_coach_id := public.coach_id_for_user();
  if v_coach_id is null then
    raise exception 'Coach profile not linked.' using errcode = 'P0001';
  end if;

  if not public.coach_teaches_class(v_coach_id, v_class) then
    raise exception 'Coach is not assigned to this class.' using errcode = 'P0001';
  end if;

  if not public.coach_has_discipline_access(v_coach_id, v_class.discipline_id) then
    raise exception 'Coach is not assigned to this discipline.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_coach_class_access(uuid) from public;
grant execute on function public.assert_coach_class_access(uuid) to authenticated;

create or replace function public.require_roll_call_coach_for_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_roll_call_coach();
  perform public.assert_coach_class_access(p_class_id);
end;
$$;

revoke all on function public.require_roll_call_coach_for_class(uuid) from public;
grant execute on function public.require_roll_call_coach_for_class(uuid) to authenticated;

alter table public.coach_member_notes enable row level security;

drop policy if exists "coach_member_notes select coach admin" on public.coach_member_notes;
create policy "coach_member_notes select coach admin"
  on public.coach_member_notes
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      public.is_coach_or_admin()
      or (visibility = 'member_visible' and auth.uid() = user_id)
    )
  );

drop policy if exists "coach_member_notes insert coach" on public.coach_member_notes;
create policy "coach_member_notes insert coach"
  on public.coach_member_notes
  for insert
  to authenticated
  with check (
    public.is_coach_or_admin()
    and coach_id = public.coach_id_for_user()
  );

drop policy if exists "coach_member_notes update coach" on public.coach_member_notes;
create policy "coach_member_notes update coach"
  on public.coach_member_notes
  for update
  to authenticated
  using (
    deleted_at is null
    and coach_id = public.coach_id_for_user()
  )
  with check (
    coach_id = public.coach_id_for_user()
  );

-- ── assigned disciplines read model ───────────────────────────────────────────

create or replace function public.get_coach_assigned_disciplines(p_coach_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_coach_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'slug', d.slug,
          'displayName', d.display_name,
          'hasRankProgression', d.has_rank_progression
        )
        order by d.sort_order asc, d.display_name asc
      )
      from public.coach_disciplines cd
      join public.disciplines d on d.id = cd.discipline_id
      where cd.coach_id = v_coach_id
        and d.active = true
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.get_coach_assigned_disciplines(uuid) from public, anon;
grant execute on function public.get_coach_assigned_disciplines(uuid) to authenticated;

-- ── coach dashboard — discipline-scoped classes ───────────────────────────────

create or replace function public.get_coach_dashboard(p_coach_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_day_start timestamptz := (v_today::text || ' 00:00:00+04')::timestamptz;
  v_day_end timestamptz := (v_today::text || ' 23:59:59.999+04')::timestamptz;
  v_classes jsonb := '[]'::jsonb;
  v_today_class_count int := 0;
  v_live_class_count int := 0;
  v_today_check_ins int := 0;
  v_promotion_candidate_count int := 0;
begin
  if auth.uid() is null then
    raise exception using message = 'Not authenticated', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_coach_id is null then
    raise exception using message = 'Coach id is required', errcode = 'P0001';
  end if;

  select *
    into v_coach
  from public.coaches
  where id = p_coach_id;

  if v_coach.id is null then
    raise exception using message = 'Coach not found', errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'discipline', coalesce(d.display_name, c.discipline),
        'disciplineId', c.discipline_id,
        'description', c.description,
        'coachName', coalesce(c.coach_name, 'Coach'),
        'coachId', c.coach_id,
        'startsAt', c.starts_at,
        'durationMinutes', c.duration_minutes,
        'capacity', c.capacity,
        'level', coalesce(c.level, 'All Levels'),
        'imageUrl', c.image_url,
        'bookedCount', c.booked_count,
        'isAvailable', c.is_available,
        'isWaitlistAvailable', c.is_waitlist_available,
        'isCancelled', c.is_cancelled,
        'mindbodyClassId', c.mindbody_class_id,
        'staffMindbodyId', c.staff_mindbody_id
      )
      order by c.starts_at asc
    ),
    '[]'::jsonb
  )
    into v_classes
  from public.classes c
  left join public.disciplines d on d.id = c.discipline_id
  where c.mindbody_class_id is not null
    and c.is_cancelled = false
    and c.starts_at >= v_day_start
    and c.starts_at <= v_day_end
    and public.coach_teaches_class(v_coach.id, c)
    and public.coach_has_discipline_access(v_coach.id, c.discipline_id);

  select count(*)::int
    into v_today_class_count
  from jsonb_array_elements(v_classes) as row;

  select count(*)::int
    into v_live_class_count
  from jsonb_array_elements(v_classes) as row
  where now() >= (row->>'startsAt')::timestamptz
    and now() < (row->>'startsAt')::timestamptz
      + ((row->>'durationMinutes')::int * interval '1 minute');

  select count(*)::int
    into v_today_check_ins
  from public.check_ins ci
  where ci.checked_in_at >= v_day_start
    and ci.checked_in_at <= v_day_end;

  select count(*)::int
    into v_promotion_candidate_count
  from public.list_promotion_candidates('bjj') c
  where c.candidate_reason <> 'tracking';

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'todayClassCount', v_today_class_count,
      'liveClassCount', v_live_class_count,
      'todayCheckIns', v_today_check_ins,
      'promotionCandidateCount', v_promotion_candidate_count
    ),
    'classes', v_classes
  );
end;
$$;

-- ── promotion candidates — coach discipline guard ───────────────────────────────

create or replace function public.list_promotion_candidates(p_discipline text default 'bjj')
returns table (
  user_id uuid,
  full_name text,
  email text,
  belt_rank text,
  belt_stripes int,
  percent numeric,
  training_days int,
  recent_check_ins int,
  candidate_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_discipline_id uuid;
  v_coach_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    return;
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    v_coach_id := public.coach_id_for_user();
    if v_coach_id is null then
      return;
    end if;

    if not public.coach_has_discipline_access(v_coach_id, v_discipline_id) then
      return;
    end if;
  end if;

  v_cutoff := (timezone('Asia/Dubai', now())::date - interval '14 days') at time zone 'Asia/Dubai';

  return query
  with recent as (
    select
      ci.user_id,
      count(*)::int as recent_check_ins
    from public.check_ins ci
    left join public.classes c on c.id = ci.class_id
    where ci.checked_in_at >= v_cutoff
      and ci.signed_in = true
      and ci.missed = false
      and ci.late_cancelled = false
      and (c.discipline_id = v_discipline_id or ci.class_id is null)
    group by ci.user_id
  )
  select
    p.id as user_id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    rl.name as belt_rank,
    mrp.stripe as belt_stripes,
    mrp.percent_complete as percent,
    public.count_discipline_training_days(p.id, v_discipline_id) as training_days,
    coalesce(r.recent_check_ins, 0) as recent_check_ins,
    case
      when mrp.percent_complete >= 100 then 'ready_for_stripe'
      when mrp.percent_complete >= 80 then 'near_ready'
      else 'tracking'
    end as candidate_reason
  from public.member_rank_progress mrp
  join public.rank_levels rl on rl.id = mrp.rank_level_id
  join public.profiles p on p.id = mrp.user_id
  join auth.users u on u.id = p.id
  left join recent r on r.user_id = p.id
  where mrp.discipline_id = v_discipline_id
    and mrp.percent_complete >= 80
  order by
    case when mrp.percent_complete >= 100 then 0 else 1 end,
    mrp.percent_complete desc,
    coalesce(r.recent_check_ins, 0) desc,
    p.full_name;
end;
$$;

-- ── walk-in search — discipline-scoped members ────────────────────────────────

create or replace function public.coach_search_members(p_query text)
returns table (
  id uuid,
  full_name text,
  email text,
  belt_rank text,
  belt_stripes int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_coach_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_query is null then
    return;
  end if;

  v_coach_id := public.coach_id_for_user();

  return query
  select
    p.id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    coalesce(rl.name, p.belt_rank) as belt_rank,
    coalesce(mrp.stripe, p.belt_stripes) as belt_stripes
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select mrp.stripe, rl.name
    from public.member_rank_progress mrp
    join public.rank_levels rl on rl.id = mrp.rank_level_id
    join public.disciplines d on d.id = mrp.discipline_id
    where mrp.user_id = p.id
    order by case when d.slug = 'bjj' then 1 else 2 end
    limit 1
  ) mrp on true
  where (
    p.full_name ilike '%' || v_query || '%'
    or u.email ilike '%' || v_query || '%'
  )
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or v_coach_id is null
    or not exists (select 1 from public.coach_disciplines cd where cd.coach_id = v_coach_id)
    or exists (
      select 1
      from public.member_disciplines md
      join public.coach_disciplines cd on cd.discipline_id = md.discipline_id
      where md.user_id = p.id
        and md.active = true
        and cd.coach_id = v_coach_id
    )
  )
  order by p.full_name
  limit 20;
end;
$$;

-- ── post-class notes RPCs ─────────────────────────────────────────────────────

create or replace function public.save_coach_member_note(
  p_user_id uuid,
  p_class_id uuid,
  p_discipline_id uuid,
  p_body text,
  p_visibility text default 'coach_admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_class public.classes%rowtype;
  v_note public.coach_member_notes%rowtype;
  v_body text := nullif(trim(p_body), '');
  v_visibility text := coalesce(nullif(trim(p_visibility), ''), 'coach_admin');
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_user_id is null or p_discipline_id is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_visibility not in ('coach_admin', 'member_visible') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  v_coach_id := public.coach_id_for_user();
  if v_coach_id is null then
    raise exception 'Coach profile not linked.' using errcode = 'P0001';
  end if;

  if p_class_id is not null then
    select * into v_class from public.classes where id = p_class_id;
    if not found then
      raise exception using message = 'NOT_FOUND', errcode = 'P0001';
    end if;
    perform public.assert_coach_class_access(p_class_id);
  end if;

  if not public.coach_has_discipline_access(v_coach_id, p_discipline_id) then
    raise exception 'Coach is not assigned to this discipline.' using errcode = 'P0001';
  end if;

  insert into public.coach_member_notes (
    coach_id,
    user_id,
    class_id,
    discipline_id,
    body,
    visibility
  )
  values (
    v_coach_id,
    p_user_id,
    p_class_id,
    p_discipline_id,
    v_body,
    v_visibility
  )
  returning * into v_note;

  return jsonb_build_object(
    'id', v_note.id,
    'userId', v_note.user_id,
    'classId', v_note.class_id,
    'disciplineId', v_note.discipline_id,
    'body', v_note.body,
    'visibility', v_note.visibility,
    'createdAt', v_note.created_at
  );
end;
$$;

create or replace function public.list_coach_member_notes_for_class(p_class_id uuid)
returns jsonb
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

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  perform public.assert_coach_class_access(p_class_id);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'userId', n.user_id,
          'memberName', coalesce(p.full_name, 'Member'),
          'body', n.body,
          'visibility', n.visibility,
          'createdAt', n.created_at
        )
        order by n.created_at desc
      )
      from public.coach_member_notes n
      join public.profiles p on p.id = n.user_id
      where n.class_id = p_class_id
        and n.deleted_at is null
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.save_coach_member_note(uuid, uuid, uuid, text, text) from public, anon;
revoke execute on function public.list_coach_member_notes_for_class(uuid) from public, anon;
grant execute on function public.save_coach_member_note(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.list_coach_member_notes_for_class(uuid) to authenticated;

-- ── roll call — class access guard ────────────────────────────────────────────

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
    'config', public.roll_call_settings_json()
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
  perform public.require_roll_call_coach_for_class(p_class_id);

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

  perform public.assert_coach_class_access(v_session.class_id);

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
