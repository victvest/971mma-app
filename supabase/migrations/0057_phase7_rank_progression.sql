-- Migration: 0057_phase7_rank_progression.sql
-- Drop legacy functions and tables first, then create new rank_systems, rank_levels, rank_requirements, member_rank_progress, member_requirement_statuses, and rank_promotions.
-- Backfill BJJ data and seed Wrestling level system. Redefine related functions.

-- 1. Drop legacy functions to avoid return type conflicts
drop function if exists public.recompute_belt_progress(uuid, text) cascade;
drop function if exists public.mark_requirement_status(uuid, uuid, text) cascade;
drop function if exists public.award_promotion(uuid, text, int, uuid) cascade;
drop function if exists public.list_promotion_candidates(text) cascade;
drop function if exists public.coach_search_members(text) cascade;
drop function if exists public.get_member_home_dashboard(uuid) cascade;

-- Temporarily save old data into temp tables for backfilling
create temp table temp_belt_ranks as select * from public.belt_ranks;
create temp table temp_belt_requirements as select * from public.belt_requirements;
create temp table temp_member_belt_progress as select * from public.member_belt_progress;
create temp table temp_member_requirement_status as select * from public.member_requirement_status;
create temp table temp_promotions as select * from public.promotions;

-- Drop old tables
drop table if exists public.member_requirement_status cascade;
drop table if exists public.belt_requirements cascade;
drop table if exists public.member_belt_progress cascade;
drop table if exists public.promotions cascade;
drop table if exists public.belt_ranks cascade;

-- 2. Create new rank progression tables
create table public.rank_systems (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null unique references public.disciplines(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rank_levels (
  id uuid primary key default gen_random_uuid(),
  rank_system_id uuid not null references public.rank_systems(id) on delete cascade,
  name text not null,
  level_order int not null,
  stripe_count int not null default 4 check (stripe_count >= 0),
  badge_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rank_system_id, level_order)
);

create table public.rank_requirements (
  id uuid primary key default gen_random_uuid(),
  rank_level_id uuid not null references public.rank_levels(id) on delete cascade,
  stripe int not null default 0 check (stripe >= 0),
  title text not null,
  description text,
  requirement_type text not null check (requirement_type in ('attendance','skill','assessment')),
  attendance_target int check (attendance_target is null or attendance_target > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rank_level_id, stripe, title)
);

create table public.member_rank_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  rank_level_id uuid not null references public.rank_levels(id) on delete cascade,
  stripe int not null default 0 check (stripe >= 0),
  percent_complete numeric(5,2) not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, discipline_id)
);

create table public.member_requirement_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank_requirement_id uuid not null references public.rank_requirements(id) on delete cascade,
  status text not null check (status in ('locked','next','done')),
  assessed_by uuid references public.profiles(id) on delete set null,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rank_requirement_id)
);

create table public.rank_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  from_rank_level_id uuid references public.rank_levels(id) on delete set null,
  to_rank_level_id uuid not null references public.rank_levels(id) on delete cascade,
  from_stripe int check (from_stripe is null or from_stripe >= 0),
  to_stripe int not null check (to_stripe >= 0),
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now(),
  celebration_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Guardrails: Only disciplines with has_rank_progression=true can have rank systems
create or replace function public.check_discipline_has_rank_progression()
returns trigger as $$
begin
  if not exists (
    select 1 from public.disciplines
    where id = new.discipline_id and has_rank_progression = true
  ) then
    raise exception 'Discipline must have rank progression enabled' using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_discipline_rank_progression on public.rank_systems;
create trigger trg_check_discipline_rank_progression
before insert or update on public.rank_systems
for each row execute function public.check_discipline_has_rank_progression();

-- 4. Backfill BJJ Rank System, Levels, Requirements, Member Progress, Statuses, and Promotions
insert into public.rank_systems (discipline_id, name)
select id, 'BJJ Rank System' from public.disciplines where slug = 'bjj'
on conflict (discipline_id) do nothing;

insert into public.rank_levels (id, rank_system_id, name, level_order, stripe_count, created_at)
select
  br.id,
  (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'bjj')),
  br.name,
  br."order",
  br.stripes,
  br.created_at
from temp_belt_ranks br
on conflict (rank_system_id, level_order) do update
set name = excluded.name, stripe_count = excluded.stripe_count;

insert into public.rank_requirements (id, rank_level_id, stripe, title, description, requirement_type, attendance_target, sort_order, created_at)
select
  br.id,
  br.rank_id,
  br.stripe,
  br.title,
  br.description,
  br.type,
  br.attendance_target,
  coalesce(br.unlock_after_stripe, 0),
  br.created_at
from temp_belt_requirements br
on conflict (rank_level_id, stripe, title) do update
set description = excluded.description, requirement_type = excluded.requirement_type, attendance_target = excluded.attendance_target, sort_order = excluded.sort_order;

insert into public.member_rank_progress (user_id, discipline_id, rank_level_id, stripe, percent_complete, updated_at)
select
  mbp.user_id,
  (select id from public.disciplines where slug = 'bjj'),
  mbp.rank_id,
  mbp.stripe,
  mbp.percent,
  mbp.updated_at
from temp_member_belt_progress mbp
on conflict (user_id, discipline_id) do update
set rank_level_id = excluded.rank_level_id, stripe = excluded.stripe, percent_complete = excluded.percent_complete, updated_at = excluded.updated_at;

insert into public.member_requirement_statuses (user_id, rank_requirement_id, status, assessed_by, assessed_at, updated_at)
select
  mrs.user_id,
  mrs.requirement_id,
  case when mrs.status = 'now' then 'next' else mrs.status end,
  mrs.assessed_by,
  mrs.assessed_at,
  mrs.updated_at
from temp_member_requirement_status mrs
on conflict (user_id, rank_requirement_id) do update
set status = excluded.status, assessed_by = excluded.assessed_by, assessed_at = excluded.assessed_at, updated_at = excluded.updated_at;

insert into public.rank_promotions (id, user_id, discipline_id, from_rank_level_id, to_rank_level_id, from_stripe, to_stripe, awarded_by, awarded_at)
select
  p.id,
  p.user_id,
  (select id from public.disciplines where slug = 'bjj'),
  p.from_rank,
  p.to_rank,
  p.from_stripe,
  p.to_stripe,
  p.awarded_by,
  p.awarded_at
from temp_promotions p
on conflict (id) do nothing;

-- Drop temp tables
drop table temp_belt_ranks;
drop table temp_belt_requirements;
drop table temp_member_belt_progress;
drop table temp_member_requirement_status;
drop table temp_promotions;

-- 5. Seed Wrestling Rank System and Level 1 Requirements
insert into public.rank_systems (discipline_id, name)
select id, 'Wrestling Rank System' from public.disciplines where slug = 'wrestling'
on conflict (discipline_id) do nothing;

insert into public.rank_levels (rank_system_id, name, level_order, stripe_count)
values
  ((select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling')), 'Level 1', 1, 4),
  ((select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling')), 'Level 2', 2, 4),
  ((select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling')), 'Level 3', 3, 4),
  ((select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling')), 'Level 4', 4, 4)
on conflict (rank_system_id, level_order) do update
set name = excluded.name, stripe_count = excluded.stripe_count;

insert into public.rank_requirements (rank_level_id, stripe, title, description, requirement_type, attendance_target, sort_order)
values
  (
    (select id from public.rank_levels where name = 'Level 1' and rank_system_id = (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling'))),
    1,
    '15 Wrestling classes',
    'Build consistency on the wrestling mat.',
    'attendance',
    15,
    0
  ),
  (
    (select id from public.rank_levels where name = 'Level 1' and rank_system_id = (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling'))),
    1,
    'Stance & motion',
    'Basic stance, footwork, and level changes.',
    'skill',
    null,
    0
  ),
  (
    (select id from public.rank_levels where name = 'Level 1' and rank_system_id = (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling'))),
    2,
    'Penetration step',
    'Demonstrate penetration step for double leg.',
    'assessment',
    null,
    1
  ),
  (
    (select id from public.rank_levels where name = 'Level 1' and rank_system_id = (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling'))),
    3,
    'Double leg finish',
    'Finishing the double leg takedown against light resistance.',
    'skill',
    null,
    2
  ),
  (
    (select id from public.rank_levels where name = 'Level 1' and rank_system_id = (select id from public.rank_systems where discipline_id = (select id from public.disciplines where slug = 'wrestling'))),
    4,
    'Coach approval',
    'Final assessment before promotion to Level 2.',
    'assessment',
    null,
    3
  )
on conflict (rank_level_id, stripe, title) do update
set description = excluded.description, requirement_type = excluded.requirement_type, attendance_target = excluded.attendance_target, sort_order = excluded.sort_order;

-- 6. Helper function: count discipline-scoped training days
create or replace function public.count_discipline_training_days(p_user uuid, p_discipline_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(distinct (ci.checked_in_at at time zone 'Asia/Dubai')::date)::int
      from public.check_ins ci
      left join public.classes c on c.id = ci.class_id
      where ci.user_id = p_user
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
        and (c.discipline_id = p_discipline_id or ci.class_id is null)
    ),
    0
  );
$$;

-- 7. Define recompute_belt_progress
create or replace function public.recompute_belt_progress(
  p_user uuid,
  p_discipline text default 'bjj'
)
returns public.member_rank_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_rank_system_id uuid;
  v_rank_level_id uuid;
  v_rank_name text;
  v_rank_stripes int;
  v_progress public.member_rank_progress%rowtype;
  v_training_days int;
  v_done_count int := 0;
  v_total_count int := 0;
  v_req record;
  v_existing_status text;
  v_unlocked boolean;
  v_next_status text;
begin
  if p_user is null then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'User is required.';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  select id into v_rank_system_id from public.rank_systems where discipline_id = v_discipline_id;
  if v_rank_system_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Rank system not found for this discipline.';
  end if;

  select id, name, stripe_count
    into v_rank_level_id, v_rank_name, v_rank_stripes
  from public.rank_levels
  where rank_system_id = v_rank_system_id
  order by level_order
  limit 1;

  if v_rank_level_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Rank levels not found.';
  end if;

  insert into public.member_rank_progress (user_id, discipline_id, rank_level_id, stripe, percent_complete, updated_at)
  values (p_user, v_discipline_id, v_rank_level_id, 0, 0, now())
  on conflict (user_id, discipline_id) do nothing;

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if v_progress.rank_level_id is not null then
    select name, stripe_count
      into v_rank_name, v_rank_stripes
    from public.rank_levels
    where id = v_progress.rank_level_id;
  else
    v_progress.rank_level_id := v_rank_level_id;
    v_rank_name := coalesce(v_rank_name, 'White');
  end if;

  v_training_days := public.count_discipline_training_days(p_user, v_discipline_id);

  for v_req in
    select id, stripe, requirement_type, attendance_target, sort_order
    from public.rank_requirements
    where rank_level_id = v_progress.rank_level_id
    order by stripe, sort_order, title
  loop
    v_total_count := v_total_count + 1;
    v_unlocked := (v_progress.stripe >= v_req.stripe - 1);

    select status
      into v_existing_status
    from public.member_requirement_statuses
    where user_id = p_user
      and rank_requirement_id = v_req.id;

    if v_req.requirement_type = 'attendance' then
      if v_training_days >= coalesce(v_req.attendance_target, 2147483647) then
        v_next_status := 'done';
      elsif v_unlocked then
        v_next_status := 'next';
      else
        v_next_status := 'locked';
      end if;
    else
      if not v_unlocked then
        v_next_status := 'locked';
      elsif v_existing_status = 'done' then
        v_next_status := 'done';
      else
        v_next_status := coalesce(v_existing_status, 'next');
      end if;
    end if;

    insert into public.member_requirement_statuses (
      user_id,
      rank_requirement_id,
      status,
      assessed_by,
      assessed_at,
      updated_at
    )
    values (
      p_user,
      v_req.id,
      v_next_status,
      null::uuid,
      case when v_req.requirement_type = 'attendance' and v_next_status = 'done' then now() else null end,
      now()
    )
    on conflict (user_id, rank_requirement_id) do update
    set status = excluded.status,
        updated_at = now(),
        assessed_by = member_requirement_statuses.assessed_by,
        assessed_at = case
          when v_req.requirement_type = 'attendance' and excluded.status = 'done' then coalesce(member_requirement_statuses.assessed_at, now())
          else member_requirement_statuses.assessed_at
        end;

    if v_next_status = 'done' then
      v_done_count := v_done_count + 1;
    end if;
  end loop;

  update public.member_rank_progress
  set rank_level_id = v_progress.rank_level_id,
      percent_complete = case
        when v_total_count = 0 then 0
        else round((v_done_count::numeric / v_total_count::numeric) * 100, 2)
      end,
      updated_at = now()
  where user_id = p_user
    and discipline_id = v_discipline_id
  returning * into v_progress;

  if p_discipline = 'bjj' then
    update public.profiles
    set belt_rank = v_rank_name,
        belt_stripes = v_progress.stripe,
        updated_at = now()
    where id = p_user;
  end if;

  return v_progress;
end;
$$;

-- 8. Define mark_requirement_status
create or replace function public.mark_requirement_status(
  p_user uuid,
  p_requirement uuid,
  p_status text
)
returns public.member_requirement_statuses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.member_requirement_statuses%rowtype;
  v_req public.rank_requirements%rowtype;
  v_progress public.member_rank_progress%rowtype;
  v_discipline_slug text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_status not in ('next', 'done') then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Status must be next or done.';
  end if;

  select *
    into v_req
  from public.rank_requirements
  where id = p_requirement;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Requirement not found.';
  end if;

  if v_req.requirement_type = 'attendance' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Attendance requirements are computed from check-ins.';
  end if;

  select d.slug into v_discipline_slug
  from public.rank_levels rl
  join public.rank_systems rs on rs.id = rl.rank_system_id
  join public.disciplines d on d.id = rs.discipline_id
  where rl.id = v_req.rank_level_id;

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and rank_level_id = v_req.rank_level_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Member progress not found for this rank level.';
  end if;

  if v_progress.stripe < v_req.stripe - 1 then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Requirement is still locked for this member.';
  end if;

  insert into public.member_requirement_statuses (
    user_id,
    rank_requirement_id,
    status,
    assessed_by,
    assessed_at,
    updated_at
  )
  values (
    p_user,
    p_requirement,
    p_status,
    auth.uid(),
    now(),
    now()
  )
  on conflict (user_id, rank_requirement_id) do update
  set status = excluded.status,
      assessed_by = auth.uid(),
      assessed_at = now(),
      updated_at = now()
  returning * into v_row;

  perform public.recompute_belt_progress(p_user, v_discipline_slug);

  return v_row;
end;
$$;

-- 9. Define award_promotion
create or replace function public.award_promotion(
  p_user uuid,
  p_discipline text default 'bjj',
  p_to_stripe int default null,
  p_to_rank uuid default null
)
returns public.rank_promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_progress public.member_rank_progress%rowtype;
  v_from_rank_level_id uuid;
  v_from_stripe int;
  v_to_rank_level_id uuid;
  v_to_stripe int;
  v_rank_stripe_count int;
  v_promotion public.rank_promotions%rowtype;
  v_rank_name text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Rank progression only exists for BJJ and Wrestling.';
  end if;

  if not exists (
    select 1 from public.member_disciplines
    where user_id = p_user
      and discipline_id = v_discipline_id
      and active = true
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Member is not enrolled in this discipline.';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    if not exists (
      select 1 from public.coach_disciplines cd
      join public.coaches c on c.id = cd.coach_id
      where c.user_id = auth.uid()
        and cd.discipline_id = v_discipline_id
    ) then
      raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Coach is not assigned to this discipline.';
    end if;
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Member rank progress not found.';
  end if;

  v_from_rank_level_id := v_progress.rank_level_id;
  v_from_stripe := v_progress.stripe;
  v_to_rank_level_id := coalesce(p_to_rank, v_progress.rank_level_id);
  v_to_stripe := coalesce(p_to_stripe, v_progress.stripe + 1);

  select stripe_count, name
    into v_rank_stripe_count, v_rank_name
  from public.rank_levels
  where id = v_to_rank_level_id;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe > v_rank_stripe_count then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Stripe exceeds rank maximum.';
  end if;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe <= v_progress.stripe then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Promotion must advance stripe or rank.';
  end if;

  insert into public.rank_promotions (
    user_id,
    discipline_id,
    from_rank_level_id,
    to_rank_level_id,
    from_stripe,
    to_stripe,
    awarded_by,
    awarded_at
  )
  values (
    p_user,
    v_discipline_id,
    v_from_rank_level_id,
    v_to_rank_level_id,
    v_from_stripe,
    v_to_stripe,
    auth.uid(),
    now()
  )
  returning * into v_promotion;

  update public.member_rank_progress
  set rank_level_id = v_to_rank_level_id,
      stripe = v_to_stripe,
      updated_at = now()
  where user_id = p_user
    and discipline_id = v_discipline_id;

  if p_discipline = 'bjj' then
    update public.profiles
    set belt_rank = v_rank_name,
        belt_stripes = v_to_stripe,
        updated_at = now()
    where id = p_user;
  end if;

  perform public.post_points_transaction(
    p_user,
    50,
    'promotion',
    'rank_promotions',
    v_promotion.id,
    'promotion:' || v_promotion.id::text,
    jsonb_build_object('discipline', p_discipline)
  );

  perform public.evaluate_milestones(p_user);
  perform public.recompute_belt_progress(p_user, p_discipline);

  return v_promotion;
end;
$$;

-- 10. Define list_promotion_candidates
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
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    return;
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

-- 11. Define coach_search_members
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
  where p.full_name ilike '%' || v_query || '%'
     or u.email ilike '%' || v_query || '%'
  order by p.full_name
  limit 20;
end;
$$;

-- 12. Define get_member_home_dashboard
create or replace function public.get_member_home_dashboard(p_user uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_points public.points_balance_cache%rowtype;
  v_score public.discipline_scores%rowtype;
  v_progress public.member_rank_progress%rowtype;
  v_rank public.rank_levels%rowtype;
  v_rank_discipline public.disciplines%rowtype;
  v_has_rank boolean := false;
  v_training_days numeric := 0;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_classes jsonb := '[]'::jsonb;
  v_coaches jsonb := '[]'::jsonb;
  v_week jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'Not authenticated', errcode = 'P0001';
  end if;

  if v_user is null or not public.can_read_member_data(v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  perform public.rebuild_points_balance_cache(v_user);

  select d.*
    into v_rank_discipline
  from public.member_disciplines md
  join public.disciplines d on d.id = md.discipline_id
  where md.user_id = v_user
    and md.active = true
    and d.active = true
    and d.has_rank_progression = true
  order by d.sort_order asc
  limit 1;

  v_has_rank := v_rank_discipline.id is not null;

  select *
    into v_points
  from public.points_balance_cache
  where user_id = v_user;

  select *
    into v_score
  from public.discipline_scores
  where user_id = v_user;

  v_training_days := public.count_training_days(v_user);

  if v_has_rank then
    select *
      into v_progress
    from public.member_rank_progress
    where user_id = v_user
      and discipline_id = v_rank_discipline.id;

    if v_progress.rank_level_id is not null then
      select *
        into v_rank
      from public.rank_levels
      where id = v_progress.rank_level_id;
    end if;

    if v_rank.id is null then
      select rl.*
        into v_rank
      from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      where rs.discipline_id = v_rank_discipline.id
      order by rl.level_order asc
      limit 1;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'discipline', coalesce(d.display_name, c.discipline),
        'disciplineId', c.discipline_id,
        'description', c.description,
        'coachName', coalesce(co.name, c.coach_name, 'Coach'),
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
  from (
    select *
    from public.classes
    where mindbody_class_id is not null
      and is_cancelled = false
      and starts_at + (duration_minutes * interval '1 minute') > now()
    order by starts_at asc
    limit 3
  ) c
  left join public.disciplines d on d.id = c.discipline_id
  left join public.coaches co on co.id = c.coach_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'mindbodyStaffId', c.mindbody_staff_id,
        'name', c.name,
        'specialty', c.specialty,
        'rank', c.rank,
        'rating', c.rating,
        'bio', c.bio,
        'photoUrl', c.photo_url,
        'isHeadCoach', c.is_head_coach
      )
      order by c.is_head_coach desc, c.sort_order asc, c.name asc
    ),
    '[]'::jsonb
  )
    into v_coaches
  from (
    select *
    from public.coaches
    where slug is not null
      and coalesce(active, true) = true
    order by is_head_coach desc, sort_order asc, name asc
    limit 5
  ) c;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(day_value, 'YYYY-MM-DD'),
        'trained', exists (
          select 1
          from public.check_ins ci
          where ci.user_id = v_user
            and ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
            and (ci.checked_in_at at time zone 'Asia/Dubai')::date = day_value::date
        )
      )
      order by day_value asc
    ),
    '[]'::jsonb
  )
    into v_week
  from generate_series(v_today - 6, v_today, interval '1 day') as days(day_value);

  return jsonb_build_object(
    'upcomingClasses', v_classes,
    'coachPreview', v_coaches,
    'points', jsonb_build_object(
      'userId', v_user,
      'balance', coalesce(v_points.balance, 0),
      'tier', coalesce(v_points.tier, 'bronze'),
      'lifetimePoints', coalesce(v_points.lifetime_points, 0),
      'updatedAt', v_points.updated_at
    ),
    'disciplineScore', jsonb_build_object(
      'score', coalesce(v_score.score, 0),
      'currentStreak', coalesce((v_score.components->>'currentStreak')::numeric, 0),
      'bestStreak', coalesce((v_score.components->>'bestStreak')::numeric, 0),
      'trainingDays', v_training_days,
      'trainingDays30d', coalesce((v_score.components->>'trainingDays30d')::numeric, 0),
      'monthlyGoalPct', coalesce((v_score.components->>'monthlyGoalPct')::numeric, 0),
      'computedAt', v_score.computed_at,
      'isPlaceholderWeights', coalesce((v_score.components->>'weightsPlaceholder')::boolean, false),
      'lastTrainingDay', v_score.components->>'lastTrainingDay',
      'graceUntil', v_score.components->>'graceUntil',
      'streakStatus', coalesce(v_score.components->>'streakStatus', 'inactive'),
      'graceDaysUsed', coalesce((v_score.components->>'graceDaysUsed')::numeric, 0)
    ),
    'weekActivity', v_week,
    'rankEligibility', jsonb_build_object(
      'eligible', v_has_rank,
      'disciplineSlug', v_rank_discipline.slug,
      'disciplineName', v_rank_discipline.display_name
    ),
    'beltProgress', case
      when v_has_rank then jsonb_build_object(
        'userId', v_user,
        'discipline', v_rank_discipline.slug,
        'rankId', coalesce(v_progress.rank_level_id, v_rank.id),
        'rankName', coalesce(v_rank.name, 'White'),
        'stripe', coalesce(v_progress.stripe, 0),
        'maxStripes', coalesce(v_rank.stripe_count, 4),
        'percent', coalesce(v_progress.percent_complete, 0),
        'trainingDays', public.count_discipline_training_days(v_user, v_rank_discipline.id),
        'updatedAt', coalesce(v_progress.updated_at, now())
      )
      else null
    end
  );
end;
$$;

-- 13. Define on_check_in & on_check_in_update to recompute all active rank-track disciplines
create or replace function public.on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  perform public.award_check_in_points(new.user_id, new.id);

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);
    
    for v_rec in
      select d.slug
      from public.member_disciplines md
      join public.disciplines d on d.id = md.discipline_id
      where md.user_id = new.user_id
        and md.active = true
        and d.has_rank_progression = true
    loop
      perform public.recompute_belt_progress(new.user_id, v_rec.slug);
    end loop;
  exception
    when others then
      raise warning 'Phase 7 check-in recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.on_check_in_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points_awarded boolean;
  v_balance int;
  v_lifetime int;
  v_new_balance int;
  v_new_lifetime int;
  v_tier text;
  v_old_valid boolean;
  v_new_valid boolean;
  v_rec record;
begin
  v_old_valid := coalesce(old.signed_in, true) = true
    and coalesce(old.missed, false) = false
    and coalesce(old.late_cancelled, false) = false;
  v_new_valid := coalesce(new.signed_in, true) = true
    and coalesce(new.missed, false) = false
    and coalesce(new.late_cancelled, false) = false;

  if v_old_valid and not v_new_valid then
    select exists (
      select 1
      from public.points_ledger
      where reason = 'check_in'
        and ref_id = new.id
    ) into v_points_awarded;

    if v_points_awarded then
      select balance, lifetime_points
        into v_balance, v_lifetime
      from public.points_accounts
      where user_id = new.user_id
      for update;

      v_new_balance := greatest(0, coalesce(v_balance, 0) - 10);
      v_new_lifetime := greatest(0, coalesce(v_lifetime, 0) - 10);
      v_tier := case
        when v_new_lifetime >= 4000 then 'gold'
        when v_new_lifetime >= 1500 then 'silver'
        else 'bronze'
      end;

      update public.points_accounts
      set balance = v_new_balance,
          lifetime_points = v_new_lifetime,
          tier = v_tier,
          updated_at = now()
      where user_id = new.user_id;

      delete from public.points_ledger
      where reason = 'check_in'
        and ref_id = new.id;
    end if;
  elsif not v_old_valid and v_new_valid then
    perform public.award_check_in_points(new.user_id, new.id);
  end if;

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);
    
    for v_rec in
      select d.slug
      from public.member_disciplines md
      join public.disciplines d on d.id = md.discipline_id
      where md.user_id = new.user_id
        and md.active = true
        and d.has_rank_progression = true
    loop
      perform public.recompute_belt_progress(new.user_id, v_rec.slug);
    end loop;
  exception
    when others then
      raise warning 'Phase 7 update recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

-- 13. Create Compatibility Views & Triggers for 971mma-admin
create or replace view public.belt_ranks as
select
  rl.id,
  d.slug as discipline,
  rl.name,
  rl.level_order as "order",
  rl.stripe_count as stripes,
  rl.created_at
from public.rank_levels rl
join public.rank_systems rs on rs.id = rl.rank_system_id
join public.disciplines d on d.id = rs.discipline_id;

create or replace view public.belt_requirements as
select
  rr.id,
  rr.rank_level_id as rank_id,
  rr.stripe,
  rr.title,
  rr.description,
  rr.requirement_type as type,
  rr.attendance_target,
  null::int as unlock_after_stripe,
  rr.created_at
from public.rank_requirements rr;

-- Trigger to handle updates to belt_ranks view
create or replace function public.trg_fun_update_belt_ranks_view()
returns trigger as $$
declare
  v_discipline_id uuid;
  v_rank_system_id uuid;
begin
  select id into v_discipline_id from public.disciplines where slug = new.discipline;
  if v_discipline_id is null then
    raise exception 'Discipline not found' using errcode = 'P0001';
  end if;

  select id into v_rank_system_id from public.rank_systems where discipline_id = v_discipline_id;
  if v_rank_system_id is null then
    insert into public.rank_systems (discipline_id, name)
    values (v_discipline_id, upper(new.discipline) || ' Rank System')
    returning id into v_rank_system_id;
  end if;

  update public.rank_levels
  set name = new.name,
      level_order = new.order,
      stripe_count = new.stripes,
      rank_system_id = v_rank_system_id,
      updated_at = now()
  where id = old.id;

  return new;
end;
$$ language plpgsql;

create trigger trg_update_belt_ranks_view
instead of update on public.belt_ranks
for each row execute function public.trg_fun_update_belt_ranks_view();

-- Trigger to handle updates to belt_requirements view
create or replace function public.trg_fun_update_belt_requirements_view()
returns trigger as $$
begin
  update public.rank_requirements
  set stripe = new.stripe,
      title = new.title,
      description = new.description,
      requirement_type = new.type,
      attendance_target = new.attendance_target,
      updated_at = now()
  where id = old.id;

  return new;
end;
$$ language plpgsql;

create trigger trg_update_belt_requirements_view
instead of update on public.belt_requirements
for each row execute function public.trg_fun_update_belt_requirements_view();

-- 14. Enable RLS on new tables and set up select policies
alter table public.rank_systems enable row level security;
alter table public.rank_levels enable row level security;
alter table public.rank_requirements enable row level security;
alter table public.member_rank_progress enable row level security;
alter table public.member_requirement_statuses enable row level security;
alter table public.rank_promotions enable row level security;

create policy "anyone can select rank_systems" on public.rank_systems for select using (true);
create policy "anyone can select rank_levels" on public.rank_levels for select using (true);
create policy "anyone can select rank_requirements" on public.rank_requirements for select using (true);

create policy "select member_rank_progress" on public.member_rank_progress
  for select using (auth.uid() = user_id or public.is_coach_or_admin() or exists (select 1 from public.guardian_links where guardian_user_id = auth.uid() and trainee_user_id = user_id and status = 'active'));

create policy "select member_requirement_statuses" on public.member_requirement_statuses
  for select using (auth.uid() = user_id or public.is_coach_or_admin() or exists (select 1 from public.guardian_links where guardian_user_id = auth.uid() and trainee_user_id = user_id and status = 'active'));

create policy "select rank_promotions" on public.rank_promotions
  for select using (auth.uid() = user_id or public.is_coach_or_admin() or exists (select 1 from public.guardian_links where guardian_user_id = auth.uid() and trainee_user_id = user_id and status = 'active'));

create policy "admins manage rank_systems" on public.rank_systems for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admins manage rank_levels" on public.rank_levels for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admins manage rank_requirements" on public.rank_requirements for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 15. Grants
grant execute on function public.recompute_belt_progress(uuid, text) to authenticated;
grant execute on function public.mark_requirement_status(uuid, uuid, text) to authenticated;
grant execute on function public.award_promotion(uuid, text, int, uuid) to authenticated;
grant execute on function public.list_promotion_candidates(text) to authenticated;
grant execute on function public.coach_search_members(text) to authenticated;
