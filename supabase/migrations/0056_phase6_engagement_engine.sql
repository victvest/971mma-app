-- Phase 6: Streak, milestones, points, and rewards engine hardening.
-- The ledger is the source of truth; cache tables exist only for fast reads.

create table if not exists public.member_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0 check (current_streak >= 0),
  best_streak int not null default 0 check (best_streak >= 0),
  total_check_ins int not null default 0 check (total_check_ins >= 0),
  last_training_day date,
  grace_until date,
  streak_status text not null default 'inactive'
    check (streak_status in ('inactive', 'active', 'grace', 'broken')),
  grace_days_used int not null default 0 check (grace_days_used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.member_streaks
  add column if not exists last_training_day date,
  add column if not exists grace_until date,
  add column if not exists streak_status text not null default 'inactive',
  add column if not exists grace_days_used int not null default 0;

create table if not exists public.points_balance_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  last_ledger_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.points_ledger
  add column if not exists idempotency_key text,
  add column if not exists ref_table text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_points_ledger_user_idempotency
  on public.points_ledger (user_id, idempotency_key)
  where idempotency_key is not null;

drop index if exists public.idx_points_ledger_reason_ref;
create unique index if not exists idx_points_ledger_user_reason_ref
  on public.points_ledger (user_id, reason, ref_id)
  where ref_id is not null;

do $$
begin
  alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
  alter table public.points_ledger
    add constraint points_ledger_reason_check
    check (
      reason in (
        'check_in',
        'redeem',
        'bonus',
        'adjustment',
        'milestone',
        'promotion',
        'referral',
        'birthday'
      )
    );
exception
  when duplicate_object then null;
end $$;

alter table public.milestones
  add column if not exists description text,
  add column if not exists trigger_type text not null default 'attendance_days',
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists points_award int not null default 0 check (points_award >= 0),
  add column if not exists hidden boolean not null default false,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.milestones drop constraint if exists milestones_trigger_type_check;
  alter table public.milestones
    add constraint milestones_trigger_type_check
    check (trigger_type in ('attendance_days', 'streak', 'promotion', 'manual'));
exception
  when duplicate_object then null;
end $$;

alter table public.member_milestones
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.rewards_catalog
  add column if not exists description text,
  add column if not exists available_from timestamptz,
  add column if not exists available_until timestamptz,
  add column if not exists max_per_user int check (max_per_user is null or max_per_user > 0),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.redemptions
  add column if not exists fulfilled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_mindbody_client_id text,
  status text not null default 'pending'
    check (status in ('pending', 'activated', 'qualified', 'rejected', 'awarded')),
  qualifying_check_ins int not null default 0 check (qualifying_check_ins >= 0),
  points_awarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referrer_user_id, referred_user_id),
  unique (referrer_user_id, referred_mindbody_client_id)
);

alter table public.member_streaks enable row level security;
alter table public.points_balance_cache enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "member_streaks select own" on public.member_streaks;
create policy "member_streaks select own" on public.member_streaks
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "member_streaks select admin" on public.member_streaks;
create policy "member_streaks select admin" on public.member_streaks
  for select to authenticated using (public.is_admin());

drop policy if exists "points_balance_cache select own" on public.points_balance_cache;
create policy "points_balance_cache select own" on public.points_balance_cache
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "points_balance_cache select admin" on public.points_balance_cache;
create policy "points_balance_cache select admin" on public.points_balance_cache
  for select to authenticated using (public.is_admin());

drop policy if exists "points_ledger select own" on public.points_ledger;
create policy "points_ledger select own" on public.points_ledger
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "points_ledger select admin" on public.points_ledger;
create policy "points_ledger select admin" on public.points_ledger
  for select to authenticated using (public.is_admin());

drop policy if exists "member_milestones select own" on public.member_milestones;
create policy "member_milestones select own" on public.member_milestones
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "redemptions select own" on public.redemptions;
create policy "redemptions select own" on public.redemptions
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "referrals select own" on public.referrals;
create policy "referrals select own" on public.referrals
  for select to authenticated using (
    public.can_read_member_data(referrer_user_id)
    or (referred_user_id is not null and public.can_read_member_data(referred_user_id))
  );

drop policy if exists "referrals select admin" on public.referrals;
create policy "referrals select admin" on public.referrals
  for select to authenticated using (public.is_admin());

create or replace function public.points_tier_for_lifetime(p_lifetime int)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when greatest(coalesce(p_lifetime, 0), 0) >= 4000 then 'gold'
    when greatest(coalesce(p_lifetime, 0), 0) >= 1500 then 'silver'
    else 'bronze'
  end;
$$;

create or replace function public.rebuild_points_balance_cache(p_user uuid)
returns public.points_balance_cache
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int := 0;
  v_lifetime int := 0;
  v_last_ledger uuid;
  v_row public.points_balance_cache%rowtype;
begin
  if p_user is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select
    greatest(coalesce(sum(delta), 0), 0)::int,
    greatest(coalesce(sum(
      case
        when delta > 0 and reason <> 'adjustment' then delta
        when delta < 0
          and reason = 'adjustment'
          and metadata ->> 'adjustmentType' = 'attendance_reversal'
          then delta
        else 0
      end
    ), 0), 0)::int
  into v_balance, v_lifetime
  from public.points_ledger
  where user_id = p_user;

  select id
    into v_last_ledger
  from public.points_ledger
  where user_id = p_user
  order by created_at desc, id desc
  limit 1;

  insert into public.points_balance_cache (
    user_id,
    balance,
    tier,
    lifetime_points,
    last_ledger_id,
    updated_at
  )
  values (
    p_user,
    v_balance,
    public.points_tier_for_lifetime(v_lifetime),
    v_lifetime,
    v_last_ledger,
    now()
  )
  on conflict (user_id) do update
  set balance = excluded.balance,
      tier = excluded.tier,
      lifetime_points = excluded.lifetime_points,
      last_ledger_id = excluded.last_ledger_id,
      updated_at = now()
  returning * into v_row;

  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (p_user, v_row.balance, v_row.tier, v_row.lifetime_points, v_row.updated_at)
  on conflict (user_id) do update
  set balance = excluded.balance,
      tier = excluded.tier,
      lifetime_points = excluded.lifetime_points,
      updated_at = excluded.updated_at;

  return v_row;
end;
$$;

create or replace function public.post_points_transaction(
  p_user uuid,
  p_delta int,
  p_reason text,
  p_ref_table text default null,
  p_ref_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.points_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache public.points_balance_cache%rowtype;
  v_existing public.points_ledger%rowtype;
  v_row public.points_ledger%rowtype;
  v_new_balance int;
  v_lifetime_delta int := 0;
  v_new_lifetime int;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_user is null or p_delta = 0 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_reason not in (
    'check_in',
    'redeem',
    'bonus',
    'adjustment',
    'milestone',
    'promotion',
    'referral',
    'birthday'
  ) then
    raise exception using message = 'INVALID_POINTS_REASON', errcode = 'P0001';
  end if;

  if v_key is not null then
    select *
      into v_existing
    from public.points_ledger
    where user_id = p_user
      and idempotency_key = v_key;

    if found then
      return v_existing;
    end if;
  end if;

  if p_ref_id is not null then
    select *
      into v_existing
    from public.points_ledger
    where user_id = p_user
      and reason = p_reason
      and ref_id = p_ref_id;

    if found then
      return v_existing;
    end if;
  end if;

  perform public.rebuild_points_balance_cache(p_user);

  select *
    into v_cache
  from public.points_balance_cache
  where user_id = p_user
  for update;

  v_new_balance := coalesce(v_cache.balance, 0) + p_delta;

  if v_new_balance < 0 then
    raise exception using message = 'INSUFFICIENT_POINTS', errcode = 'P0001';
  end if;

  if p_delta > 0 and p_reason <> 'adjustment' then
    v_lifetime_delta := p_delta;
  elsif p_delta < 0
    and p_reason = 'adjustment'
    and v_metadata ->> 'adjustmentType' = 'attendance_reversal' then
    v_lifetime_delta := p_delta;
  end if;

  v_new_lifetime := greatest(coalesce(v_cache.lifetime_points, 0) + v_lifetime_delta, 0);

  insert into public.points_ledger (
    user_id,
    delta,
    reason,
    ref_id,
    balance_after,
    idempotency_key,
    ref_table,
    metadata,
    updated_at
  )
  values (
    p_user,
    p_delta,
    p_reason,
    p_ref_id,
    v_new_balance,
    v_key,
    nullif(trim(coalesce(p_ref_table, '')), ''),
    v_metadata,
    now()
  )
  returning * into v_row;

  update public.points_balance_cache
  set balance = v_new_balance,
      lifetime_points = v_new_lifetime,
      tier = public.points_tier_for_lifetime(v_new_lifetime),
      last_ledger_id = v_row.id,
      updated_at = now()
  where user_id = p_user
  returning * into v_cache;

  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (p_user, v_cache.balance, v_cache.tier, v_cache.lifetime_points, v_cache.updated_at)
  on conflict (user_id) do update
  set balance = excluded.balance,
      tier = excluded.tier,
      lifetime_points = excluded.lifetime_points,
      updated_at = excluded.updated_at;

  return v_row;
exception
  when unique_violation then
    if v_key is not null then
      select *
        into v_existing
      from public.points_ledger
      where user_id = p_user
        and idempotency_key = v_key;

      if found then
        perform public.rebuild_points_balance_cache(p_user);
        return v_existing;
      end if;
    end if;

    if p_ref_id is not null then
      select *
        into v_existing
      from public.points_ledger
      where user_id = p_user
        and reason = p_reason
        and ref_id = p_ref_id;

      if found then
        perform public.rebuild_points_balance_cache(p_user);
        return v_existing;
      end if;
    end if;

    raise;
end;
$$;

create or replace function public.count_training_days(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(distinct (checked_in_at at time zone 'Asia/Dubai')::date)::int
      from public.check_ins
      where user_id = p_user
        and signed_in = true
        and missed = false
        and late_cancelled = false
    ),
    0
  );
$$;

create or replace function public.recompute_streak(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_training_days int := 0;
  v_current_streak int := 0;
  v_best_streak int := 0;
  v_last_training_day date;
  v_grace_until date;
  v_status text := 'inactive';
  v_grace_days_used int := 0;
begin
  if p_user is null then
    return;
  end if;

  with days as (
    select distinct (checked_in_at at time zone 'Asia/Dubai')::date as training_day
    from public.check_ins
    where user_id = p_user
      and signed_in = true
      and missed = false
      and late_cancelled = false
  ),
  gaps as (
    select
      training_day,
      lag(training_day) over (order by training_day) as previous_day
    from days
  ),
  grouped as (
    select
      training_day,
      sum(
        case
          when previous_day is null then 1
          when training_day - previous_day <= 2 then 0
          else 1
        end
      ) over (order by training_day) as streak_group
    from gaps
  ),
  streaks as (
    select
      streak_group,
      min(training_day) as started_on,
      max(training_day) as ended_on,
      count(*)::int as days,
      coalesce(sum(greatest(training_day - previous_day - 1, 0)), 0)::int as grace_days_used
    from (
      select
        g.*,
        lag(training_day) over (partition by streak_group order by training_day) as previous_day
      from grouped g
    ) x
    group by streak_group
  ),
  latest as (
    select *
    from streaks
    order by ended_on desc
    limit 1
  )
  select
    coalesce((select count(*)::int from days), 0),
    coalesce((select max(days) from streaks), 0),
    coalesce((select days from latest where v_today - ended_on <= 2), 0),
    (select ended_on from latest),
    (select ended_on + 2 from latest),
    coalesce((select grace_days_used from latest), 0)
  into
    v_training_days,
    v_best_streak,
    v_current_streak,
    v_last_training_day,
    v_grace_until,
    v_grace_days_used;

  if v_last_training_day is null then
    v_status := 'inactive';
  elsif v_today = v_last_training_day or v_today = v_last_training_day + 1 then
    v_status := 'active';
  elsif v_today = v_last_training_day + 2 then
    v_status := 'grace';
  else
    v_status := 'broken';
    v_current_streak := 0;
  end if;

  insert into public.member_streaks (
    user_id,
    current_streak,
    best_streak,
    total_check_ins,
    last_training_day,
    grace_until,
    streak_status,
    grace_days_used,
    updated_at
  )
  values (
    p_user,
    v_current_streak,
    v_best_streak,
    v_training_days,
    v_last_training_day,
    v_grace_until,
    v_status,
    v_grace_days_used,
    now()
  )
  on conflict (user_id) do update
  set current_streak = excluded.current_streak,
      best_streak = greatest(public.member_streaks.best_streak, excluded.best_streak),
      total_check_ins = excluded.total_check_ins,
      last_training_day = excluded.last_training_day,
      grace_until = excluded.grace_until,
      streak_status = excluded.streak_status,
      grace_days_used = excluded.grace_days_used,
      updated_at = now();
end;
$$;

create or replace function public.evaluate_milestones(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training_days int := 0;
  v_next_milestone uuid;
  v_milestone record;
  v_existing public.member_milestones%rowtype;
  v_newly_earned boolean;
begin
  if p_user is null then
    return;
  end if;

  v_training_days := public.count_training_days(p_user);

  for v_milestone in
    select *
    from public.milestones
    where active
    order by unlock_days asc, sort_order asc, name asc
  loop
    select *
      into v_existing
    from public.member_milestones
    where user_id = p_user
      and milestone_id = v_milestone.id;

    v_newly_earned := v_training_days >= v_milestone.unlock_days
      and (not found or v_existing.earned_at is null);

    if v_training_days >= v_milestone.unlock_days then
      insert into public.member_milestones (
        user_id,
        milestone_id,
        status,
        earned_at,
        updated_at,
        metadata
      )
      values (
        p_user,
        v_milestone.id,
        'earned',
        now(),
        now(),
        jsonb_build_object('trainingDays', v_training_days)
      )
      on conflict (user_id, milestone_id) do update
      set status = 'earned',
          earned_at = coalesce(public.member_milestones.earned_at, excluded.earned_at),
          metadata = public.member_milestones.metadata || excluded.metadata,
          updated_at = now();

      if v_newly_earned and coalesce(v_milestone.points_award, 0) > 0 then
        perform public.post_points_transaction(
          p_user,
          v_milestone.points_award,
          'milestone',
          'member_milestones',
          v_milestone.id,
          'milestone:' || p_user::text || ':' || v_milestone.id::text,
          jsonb_build_object('milestoneName', v_milestone.name)
        );
      end if;
    else
      insert into public.member_milestones (
        user_id,
        milestone_id,
        status,
        earned_at,
        updated_at,
        metadata
      )
      values (
        p_user,
        v_milestone.id,
        'locked',
        null,
        now(),
        jsonb_build_object('trainingDays', v_training_days)
      )
      on conflict (user_id, milestone_id) do update
      set status = case
            when public.member_milestones.status = 'earned' then 'earned'
            else 'locked'
          end,
          metadata = public.member_milestones.metadata || excluded.metadata,
          updated_at = now();
    end if;
  end loop;

  update public.member_milestones mm
  set status = 'locked',
      updated_at = now()
  where mm.user_id = p_user
    and mm.status <> 'earned';

  select m.id
    into v_next_milestone
  from public.milestones m
  where m.active
    and m.unlock_days > v_training_days
  order by m.unlock_days asc, m.sort_order asc, m.name asc
  limit 1;

  if v_next_milestone is not null then
    update public.member_milestones
    set status = 'next',
        updated_at = now()
    where user_id = p_user
      and milestone_id = v_next_milestone
      and status <> 'earned';
  end if;
end;
$$;

create or replace function public.recompute_discipline_score(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training_days int := 0;
  v_training_days_30 int := 0;
  v_current_streak int := 0;
  v_best_streak int := 0;
  v_weeks_with_training int := 0;
  v_attendance_rate_30d numeric := 0;
  v_monthly_goal_pct numeric := 0;
  v_consistency_8w numeric := 0;
  v_score int := 0;
  v_streak public.member_streaks%rowtype;
begin
  if p_user is null then
    return;
  end if;

  perform public.recompute_streak(p_user);

  v_training_days := public.count_training_days(p_user);

  select count(distinct (checked_in_at at time zone 'Asia/Dubai')::date)::int
    into v_training_days_30
  from public.check_ins
  where user_id = p_user
    and checked_in_at >= now() - interval '30 days'
    and signed_in = true
    and missed = false
    and late_cancelled = false;

  select count(distinct date_trunc('week', checked_in_at at time zone 'Asia/Dubai'))::int
    into v_weeks_with_training
  from public.check_ins
  where user_id = p_user
    and checked_in_at >= now() - interval '56 days'
    and signed_in = true
    and missed = false
    and late_cancelled = false;

  select *
    into v_streak
  from public.member_streaks
  where user_id = p_user;

  v_current_streak := coalesce(v_streak.current_streak, 0);
  v_best_streak := coalesce(v_streak.best_streak, 0);
  v_attendance_rate_30d := least(v_training_days_30::numeric / 30, 1);
  v_monthly_goal_pct := least(v_training_days_30::numeric / 12, 1);
  v_consistency_8w := least(v_weeks_with_training::numeric / 8, 1);

  v_score := greatest(0, least(100, round(
    (0.4 * v_attendance_rate_30d * 100) +
    (0.3 * least(v_current_streak, 30)::numeric / 30 * 100) +
    (0.2 * v_monthly_goal_pct * 100) +
    (0.1 * v_consistency_8w * 100)
  )::int));

  insert into public.discipline_scores (user_id, score, components, computed_at)
  values (
    p_user,
    v_score,
    jsonb_build_object(
      'trainingDays', v_training_days,
      'trainingDays30d', v_training_days_30,
      'currentStreak', v_current_streak,
      'bestStreak', v_best_streak,
      'lastTrainingDay', v_streak.last_training_day,
      'graceUntil', v_streak.grace_until,
      'streakStatus', coalesce(v_streak.streak_status, 'inactive'),
      'graceDaysUsed', coalesce(v_streak.grace_days_used, 0),
      'attendanceRate30d', v_attendance_rate_30d,
      'monthlyGoalPct', v_monthly_goal_pct,
      'consistency8w', v_consistency_8w,
      'weeksWithTraining8w', v_weeks_with_training,
      'weightsPlaceholder', false,
      'weights', jsonb_build_object(
        'attendanceRate30d', 0.4,
        'streak', 0.3,
        'monthlyGoalPct', 0.2,
        'consistency8w', 0.1
      ),
      'timezone', 'Asia/Dubai',
      'gracePolicy', jsonb_build_object(
        'oneMissedDayAllowed', true,
        'maxGapDaysInStreak', 2,
        'sameDayMultipleClassesCountOnce', true
      )
    ),
    now()
  )
  on conflict (user_id) do update
  set score = excluded.score,
      components = public.discipline_scores.components || excluded.components,
      computed_at = now();
end;
$$;

create or replace function public.award_check_in_points(p_user uuid, p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  if exists (
    select 1
    from public.check_ins
    where id = p_checkin
      and (
        signed_in = false
        or missed = true
        or late_cancelled = true
      )
  ) then
    return;
  end if;

  perform public.post_points_transaction(
    p_user,
    10,
    'check_in',
    'check_ins',
    p_checkin,
    'check_in:' || p_checkin::text,
    jsonb_build_object('source', 'attendance')
  );
end;
$$;

create or replace function public.on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_check_in_points(new.user_id, new.id);

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);
    perform public.recompute_belt_progress(new.user_id, 'bjj');
  exception
    when others then
      raise warning 'Phase 6 non-critical recompute failed for user %: %', new.user_id, sqlerrm;
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
  v_old_valid boolean;
  v_new_valid boolean;
  v_points_awarded boolean;
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
      where user_id = new.user_id
        and reason = 'check_in'
        and ref_id = new.id
    ) into v_points_awarded;

    if v_points_awarded then
      begin
        perform public.post_points_transaction(
          new.user_id,
          -10,
          'adjustment',
          'check_ins',
          new.id,
          'check_in_reversal:' || new.id::text,
          jsonb_build_object('adjustmentType', 'attendance_reversal')
        );
      exception
        when others then
          raise warning 'Could not reverse check-in points for %: %', new.id, sqlerrm;
      end;
    end if;
  elsif not v_old_valid and v_new_valid then
    perform public.award_check_in_points(new.user_id, new.id);
  end if;

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);
    perform public.recompute_belt_progress(new.user_id, 'bjj');
  exception
    when others then
      raise warning 'Phase 6 update recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_checkin_awards on public.check_ins;
create trigger trg_checkin_awards
after insert on public.check_ins
for each row
execute function public.on_check_in();

drop trigger if exists trg_checkin_update_awards on public.check_ins;
create trigger trg_checkin_update_awards
after update of signed_in, missed, late_cancelled on public.check_ins
for each row
execute function public.on_check_in_update();

create or replace function public.redeem_reward(p_reward uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_account public.points_balance_cache%rowtype;
  v_reward public.rewards_catalog%rowtype;
  v_redemption public.redemptions%rowtype;
  v_required_tier text;
  v_tier_rank int;
  v_required_rank int;
  v_redemption_count int := 0;
begin
  if v_user is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  perform public.rebuild_points_balance_cache(v_user);

  select *
    into v_account
  from public.points_balance_cache
  where user_id = v_user
  for update;

  select *
    into v_reward
  from public.rewards_catalog
  where id = p_reward
  for update;

  if not found
    or not v_reward.active
    or v_reward.deleted_at is not null
    or coalesce((v_reward.unlock_rule ->> 'placeholder')::boolean, false) = true
    or (v_reward.available_from is not null and v_reward.available_from > now())
    or (v_reward.available_until is not null and v_reward.available_until < now()) then
    raise exception using message = 'REWARD_UNAVAILABLE', errcode = 'P0001';
  end if;

  if v_reward.inventory is not null and v_reward.inventory <= 0 then
    raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001';
  end if;

  if v_reward.max_per_user is not null then
    select count(*)::int
      into v_redemption_count
    from public.redemptions
    where user_id = v_user
      and reward_id = v_reward.id
      and status in ('pending', 'fulfilled');

    if v_redemption_count >= v_reward.max_per_user then
      raise exception using message = 'REDEMPTION_LIMIT_REACHED', errcode = 'P0001';
    end if;
  end if;

  v_required_tier := v_reward.unlock_rule ->> 'requiresTier';
  if v_required_tier is not null then
    v_tier_rank := case v_account.tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    v_required_rank := case v_required_tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    if v_tier_rank < v_required_rank then
      raise exception using message = 'REWARD_LOCKED', errcode = 'P0001';
    end if;
  end if;

  if v_account.balance < v_reward.cost_points then
    raise exception using message = 'INSUFFICIENT_POINTS', errcode = 'P0001';
  end if;

  if v_reward.inventory is not null then
    update public.rewards_catalog
    set inventory = inventory - 1,
        updated_at = now()
    where id = v_reward.id;
  end if;

  insert into public.redemptions (user_id, reward_id, cost_points, status, fulfilled_at)
  values (v_user, v_reward.id, v_reward.cost_points, 'pending', null)
  returning * into v_redemption;

  perform public.post_points_transaction(
    v_user,
    -v_reward.cost_points,
    'redeem',
    'redemptions',
    v_redemption.id,
    'redeem:' || v_redemption.id::text,
    jsonb_build_object('rewardName', v_reward.name)
  );

  return v_redemption;
end;
$$;

create or replace function public._admin_restore_redemption_points(
  p_redemption public.redemptions
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache public.points_balance_cache%rowtype;
  v_reward public.rewards_catalog%rowtype;
begin
  if exists (
    select 1
    from public.points_ledger
    where user_id = p_redemption.user_id
      and reason = 'adjustment'
      and ref_id = p_redemption.id
  ) then
    v_cache := public.rebuild_points_balance_cache(p_redemption.user_id);

    return coalesce(v_cache.balance, 0);
  end if;

  perform public.post_points_transaction(
    p_redemption.user_id,
    p_redemption.cost_points,
    'adjustment',
    'redemptions',
    p_redemption.id,
    'redemption_restore:' || p_redemption.id::text,
    jsonb_build_object('adjustmentType', 'redemption_restore')
  );

  select *
    into v_reward
  from public.rewards_catalog
  where id = p_redemption.reward_id;

  if found and v_reward.inventory is not null then
    update public.rewards_catalog
    set inventory = inventory + 1,
        updated_at = now()
    where id = v_reward.id;
  end if;

  v_cache := public.rebuild_points_balance_cache(p_redemption.user_id);

  return coalesce(v_cache.balance, 0);
end;
$$;

create or replace function public.award_birthday_points(p_user uuid)
returns public.points_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_year text := to_char(now() at time zone 'Asia/Dubai', 'YYYY');
  v_today text := to_char(now() at time zone 'Asia/Dubai', 'MM-DD');
  v_birth_day text;
  v_row public.points_ledger%rowtype;
begin
  select *
    into v_profile
  from public.profiles
  where id = p_user;

  if not found or v_profile.date_of_birth is null then
    raise exception using message = 'BIRTHDAY_NOT_AVAILABLE', errcode = 'P0001';
  end if;

  v_birth_day := to_char(v_profile.date_of_birth, 'MM-DD');

  if v_birth_day <> v_today then
    raise exception using message = 'NOT_BIRTHDAY', errcode = 'P0001';
  end if;

  v_row := public.post_points_transaction(
    p_user,
    100,
    'birthday',
    'profiles',
    null,
    'birthday:' || p_user::text || ':' || v_year,
    jsonb_build_object('awardYear', v_year)
  );

  return v_row;
end;
$$;

create or replace function public.award_referral_points(p_referral uuid)
returns public.points_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_row public.points_ledger%rowtype;
begin
  select *
    into v_referral
  from public.referrals
  where id = p_referral
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_referral.status not in ('activated', 'qualified', 'awarded') then
    raise exception using message = 'REFERRAL_NOT_QUALIFIED', errcode = 'P0001';
  end if;

  v_row := public.post_points_transaction(
    v_referral.referrer_user_id,
    250,
    'referral',
    'referrals',
    v_referral.id,
    'referral:' || v_referral.id::text,
    jsonb_build_object(
      'referredUserId', v_referral.referred_user_id,
      'referredMindbodyClientId', v_referral.referred_mindbody_client_id
    )
  );

  update public.referrals
  set status = 'awarded',
      points_awarded_at = coalesce(points_awarded_at, now()),
      updated_at = now()
  where id = v_referral.id;

  return v_row;
end;
$$;

create or replace function public.admin_search_users(
  p_query text,
  p_limit int default 20,
  p_offset int default 0,
  p_status_filter text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  mindbody_client_id text,
  points_balance int,
  attendance_count bigint,
  membership_status text,
  created_at timestamptz,
  account_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(coalesce(p_status_filter, '')), '');
begin
  perform public.require_admin();

  return query
  select
    p.id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    p.role,
    ml.mindbody_client_id,
    coalesce(pbc.balance, pa.balance, 0) as points_balance,
    (
      select count(*)::bigint
      from public.check_ins ci
      where ci.user_id = p.id
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
    ) as attendance_count,
    p.membership_status,
    p.created_at,
    p.account_status
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  left join public.points_balance_cache pbc on pbc.user_id = p.id
  left join public.points_accounts pa on pa.user_id = p.id
  where (v_status is null or p.account_status = v_status)
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
    )
  order by p.full_name nulls last, u.email
  limit v_limit
  offset v_offset;
end;
$$;

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
  v_progress public.member_belt_progress%rowtype;
  v_rank public.belt_ranks%rowtype;
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
    from public.member_belt_progress
    where user_id = v_user
      and discipline = v_rank_discipline.slug;

    if v_progress.rank_id is not null then
      select *
        into v_rank
      from public.belt_ranks
      where id = v_progress.rank_id;
    end if;

    if v_rank.id is null then
      select *
        into v_rank
      from public.belt_ranks
      where discipline = v_rank_discipline.slug
      order by "order" asc
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
        'rankId', coalesce(v_progress.rank_id, v_rank.id),
        'rankName', coalesce(v_rank.name, 'White'),
        'stripe', coalesce(v_progress.stripe, 0),
        'maxStripes', coalesce(v_rank.stripes, 4),
        'percent', coalesce(v_progress.percent, 0),
        'trainingDays', v_training_days,
        'updatedAt', coalesce(v_progress.updated_at, now())
      )
      else null
    end
  );
end;
$$;

create or replace function public.award_promotion(
  p_user uuid,
  p_discipline text default 'bjj',
  p_to_stripe int default null,
  p_to_rank uuid default null
)
returns public.promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.member_belt_progress%rowtype;
  v_from_rank uuid;
  v_from_stripe int;
  v_to_rank uuid;
  v_to_stripe int;
  v_rank_stripes int;
  v_promotion public.promotions%rowtype;
  v_rank_name text;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_belt_progress
  where user_id = p_user
    and discipline = p_discipline
  for update;

  if not found then
    raise exception using message = 'Member belt progress not found.', errcode = 'P0001';
  end if;

  v_from_rank := v_progress.rank_id;
  v_from_stripe := v_progress.stripe;
  v_to_rank := coalesce(p_to_rank, v_progress.rank_id);
  v_to_stripe := coalesce(p_to_stripe, v_progress.stripe + 1);

  select stripes, name
    into v_rank_stripes, v_rank_name
  from public.belt_ranks
  where id = v_to_rank;

  if v_to_rank = v_progress.rank_id and v_to_stripe > v_rank_stripes then
    raise exception using message = 'Stripe exceeds rank maximum.', errcode = 'P0001';
  end if;

  if v_to_rank = v_progress.rank_id and v_to_stripe <= v_progress.stripe then
    raise exception using message = 'Promotion must advance stripe or rank.', errcode = 'P0001';
  end if;

  insert into public.promotions (
    user_id,
    discipline,
    from_rank,
    to_rank,
    from_stripe,
    to_stripe,
    awarded_by,
    awarded_at
  )
  values (
    p_user,
    p_discipline,
    v_from_rank,
    v_to_rank,
    v_from_stripe,
    v_to_stripe,
    auth.uid(),
    now()
  )
  returning * into v_promotion;

  update public.member_belt_progress
  set rank_id = v_to_rank,
      stripe = v_to_stripe,
      updated_at = now()
  where user_id = p_user
    and discipline = p_discipline;

  if v_to_rank <> v_from_rank then
    select name into v_rank_name from public.belt_ranks where id = v_to_rank;
  end if;

  update public.profiles
  set belt_rank = v_rank_name,
      belt_stripes = v_to_stripe,
      updated_at = now()
  where id = p_user;

  perform public.post_points_transaction(
    p_user,
    50,
    'promotion',
    'promotions',
    v_promotion.id,
    'promotion:' || v_promotion.id::text,
    jsonb_build_object('discipline', p_discipline)
  );

  perform public.evaluate_milestones(p_user);
  perform public.recompute_belt_progress(p_user, p_discipline);

  return v_promotion;
end;
$$;

insert into public.points_balance_cache (
  user_id,
  balance,
  tier,
  lifetime_points,
  updated_at
)
select
  user_id,
  balance,
  tier,
  lifetime_points,
  updated_at
from public.points_accounts
on conflict (user_id) do update
set balance = excluded.balance,
    tier = excluded.tier,
    lifetime_points = excluded.lifetime_points,
    updated_at = excluded.updated_at;

revoke execute on function public.points_tier_for_lifetime(int) from public;
grant execute on function public.points_tier_for_lifetime(int) to authenticated;
revoke execute on function public.rebuild_points_balance_cache(uuid) from public, anon, authenticated;
revoke execute on function public.post_points_transaction(uuid, int, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.recompute_streak(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_milestones(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_discipline_score(uuid) from public, anon, authenticated;
revoke execute on function public.on_check_in() from public, anon, authenticated;
revoke execute on function public.on_check_in_update() from public, anon, authenticated;
revoke execute on function public.award_birthday_points(uuid) from public, anon, authenticated;
revoke execute on function public.award_referral_points(uuid) from public, anon, authenticated;
revoke execute on function public._admin_restore_redemption_points(public.redemptions) from public;
revoke execute on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;
revoke execute on function public.admin_search_users(text, int, int, text) from public, anon;
grant execute on function public.admin_search_users(text, int, int, text) to authenticated;
revoke execute on function public.get_member_home_dashboard(uuid) from public, anon;
grant execute on function public.get_member_home_dashboard(uuid) to authenticated;
revoke execute on function public.award_promotion(uuid, text, int, uuid) from public, anon;
grant execute on function public.award_promotion(uuid, text, int, uuid) to authenticated;
