-- Phase 5 follow-up: a counted training day requires signed_in=true, not missed, and not late-cancelled.

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
      and signed_in = true
      and missed = false
      and late_cancelled = false
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

  v_training_days := public.count_training_days(p_user);

  insert into public.member_streaks (
    user_id,
    current_streak,
    best_streak,
    total_check_ins,
    updated_at
  )
  values (p_user, v_current_streak, v_best_streak, v_training_days, now())
  on conflict (user_id) do update
  set current_streak = excluded.current_streak,
      best_streak = greatest(public.member_streaks.best_streak, excluded.best_streak),
      total_check_ins = excluded.total_check_ins,
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
begin
  if p_user is null then
    return;
  end if;

  v_training_days := public.count_training_days(p_user);

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

  with days as (
    select distinct (checked_in_at at time zone 'Asia/Dubai')::date as training_day
    from public.check_ins
    where user_id = p_user
      and signed_in = true
      and missed = false
      and late_cancelled = false
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
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_cutoff := (timezone('Asia/Dubai', now())::date - interval '14 days') at time zone 'Asia/Dubai';

  return query
  with recent as (
    select
      ci.user_id,
      count(*)::int as recent_check_ins
    from public.check_ins ci
    where ci.checked_in_at >= v_cutoff
      and ci.signed_in = true
      and ci.missed = false
      and ci.late_cancelled = false
    group by ci.user_id
  )
  select
    p.id as user_id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    p.belt_rank,
    p.belt_stripes,
    mbp.percent,
    public.count_training_days(p.id) as training_days,
    coalesce(r.recent_check_ins, 0) as recent_check_ins,
    case
      when mbp.percent >= 100 then 'ready_for_stripe'
      when mbp.percent >= 80 then 'near_ready'
      else 'tracking'
    end as candidate_reason
  from public.member_belt_progress mbp
  join public.profiles p on p.id = mbp.user_id
  join auth.users u on u.id = p.id
  left join recent r on r.user_id = p.id
  where mbp.discipline = p_discipline
    and mbp.percent >= 80
  order by
    case when mbp.percent >= 100 then 0 else 1 end,
    mbp.percent desc,
    coalesce(r.recent_check_ins, 0) desc,
    p.full_name;
end;
$$;

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
    perform public.recompute_belt_progress(new.user_id, 'bjj');
  exception
    when others then
      raise warning 'Non-critical recompute failed during checkin update for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_checkin_update_awards on public.check_ins;
create trigger trg_checkin_update_awards
after update of signed_in, missed, late_cancelled on public.check_ins
for each row
execute function public.on_check_in_update();

revoke execute on function public.count_training_days(uuid) from public, anon;
revoke execute on function public.recompute_streak(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_milestones(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_discipline_score(uuid) from public, anon, authenticated;
revoke execute on function public.list_promotion_candidates(text) from public, anon;
revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.on_check_in_update() from public, anon, authenticated;
grant execute on function public.count_training_days(uuid) to authenticated;
grant execute on function public.list_promotion_candidates(text) to authenticated;
grant execute on function public.on_check_in_update() to authenticated;
