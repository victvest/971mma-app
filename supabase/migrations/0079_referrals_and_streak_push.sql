-- Referral program (member-submit + auto-qualify on referred attendance)
-- Streak-at-risk push support + remove birthday from product surface

alter table public.referrals
  add column if not exists referred_email text;

alter table public.member_streaks
  add column if not exists streak_warning_sent_on date;

create index if not exists idx_referrals_referrer_status
  on public.referrals (referrer_user_id, status, created_at desc);

create index if not exists idx_referrals_referred_email_pending
  on public.referrals (lower(referred_email))
  where status = 'pending' and referred_email is not null;

drop policy if exists "referrals insert own pending" on public.referrals;
create policy "referrals insert own pending" on public.referrals
  for insert to authenticated
  with check (
    auth.uid() = referrer_user_id
    and status = 'pending'
  );

create or replace function public.normalize_referral_email(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(trim(p_email));
$$;

create or replace function public.link_pending_referrals(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_updated int := 0;
begin
  if p_user is null then
    return 0;
  end if;

  select lower(trim(u.email::text))
    into v_email
  from auth.users u
  where u.id = p_user;

  if v_email is null or v_email = '' then
    return 0;
  end if;

  update public.referrals r
  set referred_user_id = p_user,
      status = 'activated',
      updated_at = now()
  where r.status = 'pending'
    and r.referred_user_id is null
    and r.referrer_user_id <> p_user
    and public.normalize_referral_email(r.referred_email) = v_email;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.evaluate_referral_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_valid_check_ins int := 0;
begin
  if p_user is null then
    return;
  end if;

  perform public.link_pending_referrals(p_user);

  for v_referral in
    select *
    from public.referrals
    where referred_user_id = p_user
      and status in ('activated', 'qualified')
    for update
  loop
    select count(*)::int
      into v_valid_check_ins
    from public.check_ins ci
    where ci.user_id = p_user
      and ci.signed_in = true
      and ci.missed = false
      and ci.late_cancelled = false;

    if v_valid_check_ins >= 3 and v_referral.status <> 'awarded' then
      update public.referrals
      set qualifying_check_ins = v_valid_check_ins,
          status = 'qualified',
          updated_at = now()
      where id = v_referral.id;

      perform public.award_referral_points(v_referral.id);
    else
      update public.referrals
      set qualifying_check_ins = v_valid_check_ins,
          updated_at = now()
      where id = v_referral.id
        and qualifying_check_ins is distinct from v_valid_check_ins;
    end if;
  end loop;
end;
$$;

create or replace function public.submit_referral(p_referred_email text)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid := auth.uid();
  v_email text;
  v_self_email text;
  v_pending_count int;
  v_existing_user uuid;
  v_row public.referrals%rowtype;
begin
  if v_referrer is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  v_email := public.normalize_referral_email(p_referred_email);
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception using message = 'INVALID_EMAIL', errcode = 'P0001';
  end if;

  select lower(trim(u.email::text))
    into v_self_email
  from auth.users u
  where u.id = v_referrer;

  if v_self_email is not null and v_self_email = v_email then
    raise exception using message = 'SELF_REFERRAL', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.referrals r
    where r.referrer_user_id = v_referrer
      and r.status in ('pending', 'activated', 'qualified', 'awarded')
      and (
        public.normalize_referral_email(r.referred_email) = v_email
        or r.referred_user_id = (
          select u.id
          from auth.users u
          where lower(trim(u.email::text)) = v_email
          limit 1
        )
      )
  ) then
    raise exception using message = 'REFERRAL_EXISTS', errcode = 'P0001';
  end if;

  select count(*)::int
    into v_pending_count
  from public.referrals
  where referrer_user_id = v_referrer
    and status = 'pending';

  if v_pending_count >= 10 then
    raise exception using message = 'REFERRAL_LIMIT', errcode = 'P0001';
  end if;

  insert into public.referrals (
    referrer_user_id,
    referred_email,
    status,
    metadata
  )
  values (
    v_referrer,
    v_email,
    'pending',
    jsonb_build_object('submittedAt', now())
  )
  returning * into v_row;

  select u.id
    into v_existing_user
  from auth.users u
  where lower(trim(u.email::text)) = v_email
  limit 1;

  if v_existing_user is not null then
    perform public.link_pending_referrals(v_existing_user);
    select *
      into v_row
    from public.referrals
    where id = v_row.id;
  end if;

  return v_row;
end;
$$;

drop function if exists public.get_my_referrals();

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  referred_user_id uuid,
  referred_name text,
  status text,
  points_awarded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.referred_user_id,
    coalesce(p.full_name, 'New member') as referred_name,
    r.status,
    r.points_awarded_at,
    r.created_at,
    r.updated_at
  from public.referrals r
  left join public.profiles p on p.id = r.referred_user_id
  where r.referrer_user_id = auth.uid()
  order by r.created_at desc
  limit 25;
$$;

create or replace function public.list_streak_grace_members(p_gym_date date default (now() at time zone 'Asia/Dubai')::date)
returns table (
  user_id uuid,
  current_streak int
)
language sql
stable
security definer
set search_path = public
as $$
  select ms.user_id, ms.current_streak
  from public.member_streaks ms
  join public.profiles p on p.id = ms.user_id
  where ms.streak_status = 'grace'
    and ms.current_streak > 0
    and coalesce(ms.streak_warning_sent_on, date '1970-01-01') < p_gym_date
    and p.account_status = 'active'
    and coalesce(public.notification_enabled(ms.user_id, 'streak_warning'), true);
$$;

create or replace function public.mark_streak_warnings_sent(p_user_ids uuid[], p_gym_date date default (now() at time zone 'Asia/Dubai')::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;

  update public.member_streaks ms
  set streak_warning_sent_on = p_gym_date,
      updated_at = now()
  where ms.user_id = any(p_user_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.notification_enabled(p_user uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type ilike '%announcement%' then coalesce(np.announcements, true)
    when p_type ilike '%class%' or p_type ilike '%reminder%' then coalesce(np.class_reminders, true)
    when p_type ilike '%streak%' or p_type ilike '%milestone%' or p_type ilike '%promotion%' or p_type ilike '%belt%'
      then coalesce(np.milestones, true)
    when p_type ilike '%reward%' or p_type ilike '%redemption%' or p_type ilike '%point%' or p_type ilike '%referral%'
      then coalesce(np.rewards, true)
    when p_type ilike '%guardian%' or p_type ilike '%child%' then coalesce(np.guardian_alerts, true)
    when p_type ilike '%community%' then coalesce(np.community, true)
    else true
  end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = p_user
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
    streak_warning_sent_on,
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
    null,
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
      streak_warning_sent_on = case
        when excluded.streak_status = 'grace' then public.member_streaks.streak_warning_sent_on
        else null
      end,
      updated_at = now();
end;
$$;

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

    begin
      perform public.evaluate_referral_progress(new.user_id);
    exception
      when others then
        raise warning 'Referral progress failed for user %: %', new.user_id, sqlerrm;
    end;

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
      raise warning 'Engagement recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  if coalesce(new.signed_in, true) = true
    and coalesce(new.missed, false) = false
    and coalesce(new.late_cancelled, false) = false then
    begin
      perform public.notify_guardian_check_in(new.user_id, new.id);
    exception
      when others then
        raise warning 'Guardian check-in notification failed for user %: %', new.user_id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

grant execute on function public.submit_referral(text) to authenticated;
grant execute on function public.get_my_referrals() to authenticated;

create or replace function public.notify_member_referral_awarded(
  p_referrer uuid,
  p_referral_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_referrer is null or p_referral_id is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_referrer, 'referral'), true) then
    return;
  end if;

  v_key := 'member_referral:' || p_referrer::text || ':' || p_referral_id::text;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_referrer
      and n.type = 'reward'
      and n.payload->>'idempotencyKey' = v_key
  ) then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_referrer,
    'reward',
    jsonb_build_object(
      'title', 'Referral bonus earned',
      'body', '+250 points for a friend completing their qualifying check-ins',
      'referralId', p_referral_id,
      'pointsAward', 250,
      'url', '/(tabs)/rewards',
      'idempotencyKey', v_key
    )
  );
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

  if v_referral.status = 'awarded' then
    select *
      into v_row
    from public.points_ledger
    where ref_table = 'referrals'
      and ref_id = v_referral.id
      and reason = 'referral'
    order by created_at desc
    limit 1;

    if found then
      return v_row;
    end if;
  end if;

  if v_referral.status not in ('activated', 'qualified') then
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

  perform public.notify_member_referral_awarded(v_referral.referrer_user_id, v_referral.id);

  return v_row;
end;
$$;

revoke execute on function public.notify_member_referral_awarded(uuid, uuid) from public, anon, authenticated;

-- Invoke supabase/functions/streak-reminders daily around 6pm Asia/Dubai with CRON_SECRET.
-- Same scheduler options as class-reminders (Supabase cron, pg_cron + pg_net, GitHub Actions).

revoke execute on function public.link_pending_referrals(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_referral_progress(uuid) from public, anon, authenticated;
revoke execute on function public.list_streak_grace_members(date) from public, anon, authenticated;
revoke execute on function public.mark_streak_warnings_sent(uuid[], date) from public, anon, authenticated;
revoke execute on function public.award_birthday_points(uuid) from public, anon, authenticated;
