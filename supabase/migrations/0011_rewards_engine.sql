-- Phase 7: rewards engine.
-- All mutations are database-owned. The client can read RLS-protected rows and call redeem_reward only.

-- Placeholder economics pending final business rules (IMPLEMENTATION_PLAN.md Phase 7):
--   check-in award: +10 points
--   tiers: bronze >= 0, silver >= 1500, gold >= 4000 lifetime points
--   discipline score weights: attendance 40%, streak 30%, monthly goal 20%, 8-week consistency 10%

create or replace function public.award_check_in_points(p_user uuid, p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance int;
  v_lifetime int;
  v_new_balance int;
  v_new_lifetime int;
  v_tier text;
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (p_user, 0, 'bronze', 0, now())
  on conflict (user_id) do nothing;

  select balance, lifetime_points
    into v_balance, v_lifetime
  from public.points_accounts
  where user_id = p_user
  for update;

  if exists (
    select 1
    from public.points_ledger
    where reason = 'check_in'
      and ref_id = p_checkin
  ) then
    return;
  end if;

  v_new_balance := v_balance + 10;
  v_new_lifetime := v_lifetime + 10;
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
  where user_id = p_user;

  insert into public.points_ledger (user_id, delta, reason, ref_id, balance_after)
  values (p_user, 10, 'check_in', p_checkin, v_new_balance)
  on conflict (reason, ref_id) where ref_id is not null do nothing;
end;
$$;

create or replace function public.recompute_streak(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training_days int := 0;
  v_current_streak int := 0;
  v_best_streak int := 0;
begin
  if p_user is null then
    return;
  end if;

  with days as (
    select distinct (checked_in_at at time zone 'Asia/Dubai')::date as training_day
    from public.check_ins
    where user_id = p_user
  ),
  numbered as (
    select
      training_day,
      training_day - (row_number() over (order by training_day))::int as streak_group
    from days
  ),
  streaks as (
    select
      streak_group,
      min(training_day) as started_on,
      max(training_day) as ended_on,
      count(*)::int as days
    from numbered
    group by streak_group
  ),
  latest as (
    select max(training_day) as latest_day from days
  )
  select
    coalesce((select count(*)::int from days), 0),
    coalesce((select max(days) from streaks), 0),
    coalesce((
      select s.days
      from streaks s
      join latest l on l.latest_day between s.started_on and s.ended_on
      limit 1
    ), 0)
  into v_training_days, v_best_streak, v_current_streak;

  insert into public.discipline_scores (user_id, score, components, computed_at)
  values (
    p_user,
    0,
    jsonb_build_object(
      'trainingDays', v_training_days,
      'currentStreak', v_current_streak,
      'bestStreak', v_best_streak,
      'timezone', 'Asia/Dubai'
    ),
    now()
  )
  on conflict (user_id) do update
  set components = public.discipline_scores.components || excluded.components,
      computed_at = now();
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
begin
  if p_user is null then
    return;
  end if;

  select count(distinct (checked_in_at at time zone 'Asia/Dubai')::date)::int
    into v_training_days
  from public.check_ins
  where user_id = p_user;

  insert into public.member_milestones (user_id, milestone_id, status, earned_at, updated_at)
  select
    p_user,
    m.id,
    case when v_training_days >= m.unlock_days then 'earned' else 'locked' end,
    case when v_training_days >= m.unlock_days then now() else null end,
    now()
  from public.milestones m
  where m.active
  on conflict (user_id, milestone_id) do update
  set status = case
        when public.member_milestones.status = 'earned' then 'earned'
        when excluded.status = 'earned' then 'earned'
        else 'locked'
      end,
      earned_at = case
        when public.member_milestones.earned_at is not null then public.member_milestones.earned_at
        else excluded.earned_at
      end,
      updated_at = now();

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
  order by m.unlock_days asc, m.name asc
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
begin
  if p_user is null then
    return;
  end if;

  select count(distinct (checked_in_at at time zone 'Asia/Dubai')::date)::int
    into v_training_days
  from public.check_ins
  where user_id = p_user;

  select count(distinct (checked_in_at at time zone 'Asia/Dubai')::date)::int
    into v_training_days_30
  from public.check_ins
  where user_id = p_user
    and checked_in_at >= now() - interval '30 days';

  select count(distinct date_trunc('week', checked_in_at at time zone 'Asia/Dubai'))::int
    into v_weeks_with_training
  from public.check_ins
  where user_id = p_user
    and checked_in_at >= now() - interval '56 days';

  with days as (
    select distinct (checked_in_at at time zone 'Asia/Dubai')::date as training_day
    from public.check_ins
    where user_id = p_user
  ),
  numbered as (
    select
      training_day,
      training_day - (row_number() over (order by training_day))::int as streak_group
    from days
  ),
  streaks as (
    select
      streak_group,
      min(training_day) as started_on,
      max(training_day) as ended_on,
      count(*)::int as days
    from numbered
    group by streak_group
  ),
  latest as (
    select max(training_day) as latest_day from days
  )
  select
    coalesce((select max(days) from streaks), 0),
    coalesce((
      select s.days
      from streaks s
      join latest l on l.latest_day between s.started_on and s.ended_on
      limit 1
    ), 0)
  into v_best_streak, v_current_streak;

  v_attendance_rate_30d := least(v_training_days_30::numeric / 30, 1);
  v_monthly_goal_pct := least(v_training_days_30::numeric / 12, 1);
  v_consistency_8w := least(v_weeks_with_training::numeric / 8, 1);

  -- Placeholder formula pending final plan.md Q7/Q8 business weights:
  -- 40% 30-day attendance, 30% capped streak, 20% monthly goal, 10% 8-week consistency.
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
      'attendanceRate30d', v_attendance_rate_30d,
      'monthlyGoalPct', v_monthly_goal_pct,
      'consistency8w', v_consistency_8w,
      'weeksWithTraining8w', v_weeks_with_training,
      'weightsPlaceholder', true,
      'weights', jsonb_build_object(
        'attendanceRate30d', 0.4,
        'streak', 0.3,
        'monthlyGoalPct', 0.2,
        'consistency8w', 0.1
      ),
      'timezone', 'Asia/Dubai'
    ),
    now()
  )
  on conflict (user_id) do update
  set score = excluded.score,
      components = public.discipline_scores.components || excluded.components,
      computed_at = now();
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
  exception
    when others then
      -- Points are critical; analytics/milestones can be retried without blocking attendance.
      raise warning 'Phase 7 non-critical recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.redeem_reward(p_reward uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_account public.points_accounts%rowtype;
  v_reward public.rewards_catalog%rowtype;
  v_redemption public.redemptions%rowtype;
  v_new_balance int;
  v_required_tier text;
  v_tier_rank int;
  v_required_rank int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (v_user, 0, 'bronze', 0, now())
  on conflict (user_id) do nothing;

  select *
    into v_account
  from public.points_accounts
  where user_id = v_user
  for update;

  select *
    into v_reward
  from public.rewards_catalog
  where id = p_reward
  for update;

  if not found or not v_reward.active then
    raise exception 'REWARD_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_reward.inventory is not null and v_reward.inventory <= 0 then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  v_required_tier := v_reward.unlock_rule ->> 'requiresTier';
  if v_required_tier is not null then
    v_tier_rank := case v_account.tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    v_required_rank := case v_required_tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    if v_tier_rank < v_required_rank then
      raise exception 'REWARD_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  if v_account.balance < v_reward.cost_points then
    raise exception 'INSUFFICIENT_POINTS' using errcode = 'P0001';
  end if;

  v_new_balance := v_account.balance - v_reward.cost_points;

  update public.points_accounts
  set balance = v_new_balance,
      updated_at = now()
  where user_id = v_user;

  if v_reward.inventory is not null then
    update public.rewards_catalog
    set inventory = inventory - 1
    where id = v_reward.id;
  end if;

  insert into public.redemptions (user_id, reward_id, cost_points, status, fulfilled_at)
  values (v_user, v_reward.id, v_reward.cost_points, 'pending', null)
  returning * into v_redemption;

  insert into public.points_ledger (user_id, delta, reason, ref_id, balance_after)
  values (v_user, -v_reward.cost_points, 'redeem', v_redemption.id, v_new_balance);

  return v_redemption;
end;
$$;

drop trigger if exists trg_checkin_awards on public.check_ins;
create trigger trg_checkin_awards
after insert on public.check_ins
for each row
execute function public.on_check_in();

revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.recompute_streak(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_milestones(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_discipline_score(uuid) from public, anon, authenticated;
revoke execute on function public.on_check_in() from public, anon, authenticated;
revoke execute on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;
