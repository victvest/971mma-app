-- Phase 10: Parent portal depth — guardian notifications, child summary RPC, RLS fix.

-- Fix rank RLS: guardian_links use status 'approved', not 'active'.
drop policy if exists "select member_rank_progress" on public.member_rank_progress;
drop policy if exists "select member_requirement_statuses" on public.member_requirement_statuses;
drop policy if exists "select rank_promotions" on public.rank_promotions;

create policy "select member_rank_progress" on public.member_rank_progress
  for select using (
    auth.uid() = user_id
    or public.is_coach_or_admin()
    or exists (
      select 1
      from public.guardian_links gl
      where gl.guardian_user_id = auth.uid()
        and gl.trainee_user_id = user_id
        and gl.status = 'approved'
    )
  );

create policy "select member_requirement_statuses" on public.member_requirement_statuses
  for select using (
    auth.uid() = user_id
    or public.is_coach_or_admin()
    or exists (
      select 1
      from public.guardian_links gl
      where gl.guardian_user_id = auth.uid()
        and gl.trainee_user_id = user_id
        and gl.status = 'approved'
    )
  );

create policy "select rank_promotions" on public.rank_promotions
  for select using (
    auth.uid() = user_id
    or public.is_coach_or_admin()
    or exists (
      select 1
      from public.guardian_links gl
      where gl.guardian_user_id = auth.uid()
        and gl.trainee_user_id = user_id
        and gl.status = 'approved'
    )
  );

create unique index if not exists idx_notifications_parent_child_idempotency
  on public.notifications (user_id, ((payload->>'idempotencyKey')))
  where type = 'parent_child' and (payload->>'idempotencyKey') is not null;

create or replace function public.notify_guardians_for_trainee(
  p_trainee_user_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian record;
  v_payload jsonb;
  v_sent int := 0;
begin
  if p_trainee_user_id is null or coalesce(trim(p_title), '') = '' then
    return 0;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object(
      'title', p_title,
      'body', coalesce(p_body, ''),
      'eventType', p_event_type,
      'traineeUserId', p_trainee_user_id,
      'idempotencyKey', p_idempotency_key
    );

  for v_guardian in
    select gl.guardian_user_id
    from public.guardian_links gl
    where gl.trainee_user_id = p_trainee_user_id
      and gl.status = 'approved'
  loop
    if not coalesce(public.notification_enabled(v_guardian.guardian_user_id, 'parent_child'), true) then
      continue;
    end if;

    if p_idempotency_key is not null and exists (
      select 1
      from public.notifications n
      where n.user_id = v_guardian.guardian_user_id
        and n.type = 'parent_child'
        and n.payload->>'idempotencyKey' = p_idempotency_key
    ) then
      continue;
    end if;

    insert into public.notifications (user_id, type, payload)
    values (v_guardian.guardian_user_id, 'parent_child', v_payload);

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

create or replace function public.notify_guardian_check_in(
  p_trainee_user_id uuid,
  p_check_in_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_class_title text;
  v_checked_in_at timestamptz;
begin
  select p.full_name, coalesce(c.title, 'class'), ci.checked_in_at
    into v_name, v_class_title, v_checked_in_at
  from public.profiles p
  join public.check_ins ci on ci.user_id = p.id
  left join public.classes c on c.id = ci.class_id
  where p.id = p_trainee_user_id
    and ci.id = p_check_in_id;

  if not found then
    return 0;
  end if;

  return public.notify_guardians_for_trainee(
    p_trainee_user_id,
    'check_in',
    coalesce(v_name, 'Your trainee') || ' checked in',
    'Checked in to ' || coalesce(v_class_title, 'a class') || '.',
    jsonb_build_object(
      'checkInId', p_check_in_id,
      'classTitle', v_class_title,
      'checkedInAt', v_checked_in_at,
      'url', '/family-trainees'
    ),
    'guardian_check_in:' || p_check_in_id::text
  );
end;
$$;

create or replace function public.notify_guardian_promotion(
  p_trainee_user_id uuid,
  p_promotion_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_rank_name text;
  v_discipline text;
  v_to_stripe int;
begin
  select
    p.full_name,
    rl.name,
    d.display_name,
    rp.to_stripe
    into v_name, v_rank_name, v_discipline, v_to_stripe
  from public.rank_promotions rp
  join public.profiles p on p.id = rp.user_id
  join public.rank_levels rl on rl.id = rp.to_rank_level_id
  join public.disciplines d on d.id = rp.discipline_id
  where rp.user_id = p_trainee_user_id
    and rp.id = p_promotion_id;

  if not found then
    return 0;
  end if;

  return public.notify_guardians_for_trainee(
    p_trainee_user_id,
    'promotion',
    coalesce(v_name, 'Your trainee') || ' earned a promotion',
    coalesce(v_rank_name, 'New rank') || ' · ' || coalesce(v_discipline, 'BJJ')
      || case when coalesce(v_to_stripe, 0) > 0 then ' · ' || v_to_stripe::text || ' stripe(s)' else '' end,
    jsonb_build_object(
      'promotionId', p_promotion_id,
      'rankName', v_rank_name,
      'discipline', v_discipline,
      'url', '/(tabs)/belt-path'
    ),
    'guardian_promotion:' || p_promotion_id::text
  );
end;
$$;

create or replace function public.notify_guardian_milestone(
  p_trainee_user_id uuid,
  p_milestone_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_milestone_name text;
begin
  select p.full_name, m.name
    into v_name, v_milestone_name
  from public.profiles p
  join public.milestones m on m.id = p_milestone_id
  where p.id = p_trainee_user_id;

  if not found then
    return 0;
  end if;

  return public.notify_guardians_for_trainee(
    p_trainee_user_id,
    'milestone',
    coalesce(v_name, 'Your trainee') || ' unlocked a milestone',
    coalesce(v_milestone_name, 'New milestone'),
    jsonb_build_object(
      'milestoneId', p_milestone_id,
      'milestoneName', v_milestone_name,
      'url', '/(tabs)/rewards'
    ),
    'guardian_milestone:' || p_trainee_user_id::text || ':' || p_milestone_id::text
  );
end;
$$;

create or replace function public.notify_guardian_inactivity_if_needed(p_trainee_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak public.member_streaks%rowtype;
  v_name text;
  v_days_inactive int;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_week_key text;
begin
  select * into v_streak
  from public.member_streaks
  where user_id = p_trainee_user_id;

  if not found or v_streak.last_training_day is null then
    return 0;
  end if;

  v_days_inactive := v_today - v_streak.last_training_day;
  if v_days_inactive < 7 or v_streak.streak_status not in ('broken', 'inactive') then
    return 0;
  end if;

  select full_name into v_name from public.profiles where id = p_trainee_user_id;
  v_week_key := to_char(v_today, 'IYYY-"W"IW');

  return public.notify_guardians_for_trainee(
    p_trainee_user_id,
    'inactivity',
    coalesce(v_name, 'Your trainee') || ' has been inactive',
    v_days_inactive::text || ' days since the last counted class.',
    jsonb_build_object(
      'daysInactive', v_days_inactive,
      'lastTrainingDay', v_streak.last_training_day,
      'url', '/family-trainees'
    ),
    'guardian_inactivity:' || p_trainee_user_id::text || ':' || v_week_key
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

      if v_newly_earned then
        begin
          perform public.notify_guardian_milestone(p_user, v_milestone.id);
        exception
          when others then
            raise warning 'Guardian milestone notification failed for user %: %', p_user, sqlerrm;
        end;
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
  v_previous_status text;
begin
  if p_user is null then
    return;
  end if;

  select streak_status
    into v_previous_status
  from public.member_streaks
  where user_id = p_user;

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

  if v_status = 'broken'
    and v_last_training_day is not null
    and v_today - v_last_training_day >= 7 then
    begin
      perform public.notify_guardian_inactivity_if_needed(p_user);
    exception
      when others then
        raise warning 'Guardian inactivity notification failed for user %: %', p_user, sqlerrm;
    end;
  end if;
end;
$$;

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

  begin
    perform public.notify_guardian_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Guardian promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  return v_promotion;
end;
$$;

create or replace function public.get_guardian_children_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_children jsonb := '[]'::jsonb;
  v_link record;
  v_child jsonb;
  v_disciplines jsonb;
  v_streak public.member_streaks%rowtype;
  v_rank_name text;
  v_rank_stripe int;
  v_points int := 0;
  v_milestones jsonb;
  v_attendance jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  for v_link in
    select gl.trainee_user_id, gl.child_display_name, gl.account_mode, gl.allow_guardian_qr
    from public.guardian_links gl
    where gl.guardian_user_id = auth.uid()
      and gl.status = 'approved'
      and gl.trainee_user_id is not null
    order by gl.child_display_name asc
  loop
    select coalesce(
      jsonb_agg(d.display_name order by d.sort_order),
      '[]'::jsonb
    )
      into v_disciplines
    from public.member_disciplines md
    join public.disciplines d on d.id = md.discipline_id
    where md.user_id = v_link.trainee_user_id
      and md.active = true
      and d.active = true;

    select * into v_streak
    from public.member_streaks
    where user_id = v_link.trainee_user_id;

    select rl.name, mrp.stripe
      into v_rank_name, v_rank_stripe
    from public.member_rank_progress mrp
    join public.rank_levels rl on rl.id = mrp.rank_level_id
    join public.disciplines d on d.id = mrp.discipline_id
    where mrp.user_id = v_link.trainee_user_id
      and d.has_rank_progression = true
    order by d.sort_order
    limit 1;

    select coalesce(pbc.balance, pa.balance, 0)
      into v_points
    from public.profiles p
    left join public.points_balance_cache pbc on pbc.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    where p.id = v_link.trainee_user_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', earned_rows.milestone_id,
          'name', earned_rows.milestone_name,
          'earnedAt', earned_rows.earned_at
        )
        order by earned_rows.earned_at desc
      ),
      '[]'::jsonb
    )
      into v_milestones
    from (
      select m.id as milestone_id, m.name as milestone_name, mm.earned_at
      from public.member_milestones mm
      join public.milestones m on m.id = mm.milestone_id
      where mm.user_id = v_link.trainee_user_id
        and mm.status = 'earned'
        and coalesce(m.hidden, false) = false
      order by mm.earned_at desc
      limit 5
    ) earned_rows;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ci.id,
          'className', coalesce(c.title, 'Class'),
          'checkedInAt', ci.checked_in_at,
          'discipline', coalesce(d.display_name, c.discipline)
        )
        order by ci.checked_in_at desc
      ),
      '[]'::jsonb
    )
      into v_attendance
    from (
      select ci.id, ci.class_id, ci.checked_in_at
      from public.check_ins ci
      where ci.user_id = v_link.trainee_user_id
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
      order by ci.checked_in_at desc
      limit 5
    ) ci
    left join public.classes c on c.id = ci.class_id
    left join public.disciplines d on d.id = c.discipline_id;

    select jsonb_build_object(
      'traineeUserId', v_link.trainee_user_id,
      'displayName', coalesce(p.full_name, v_link.child_display_name),
      'avatarUrl', p.avatar_url,
      'dateOfBirth', p.date_of_birth,
      'accountMode', v_link.account_mode,
      'allowGuardianQr', v_link.allow_guardian_qr,
      'disciplines', coalesce(v_disciplines, '[]'::jsonb),
      'currentStreak', coalesce(v_streak.current_streak, 0),
      'bestStreak', coalesce(v_streak.best_streak, 0),
      'streakStatus', coalesce(v_streak.streak_status, 'inactive'),
      'rankName', v_rank_name,
      'rankStripe', v_rank_stripe,
      'pointsBalance', coalesce(v_points, 0),
      'recentMilestones', coalesce(v_milestones, '[]'::jsonb),
      'recentAttendance', coalesce(v_attendance, '[]'::jsonb)
    )
      into v_child
    from public.profiles p
    where p.id = v_link.trainee_user_id;

    v_children := v_children || jsonb_build_array(v_child);
  end loop;

  return jsonb_build_object('children', v_children);
end;
$$;

create or replace function public.admin_list_guardian_notification_events(
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  notification_id uuid,
  guardian_user_id uuid,
  guardian_name text,
  trainee_user_id uuid,
  trainee_name text,
  event_type text,
  title text,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return query
  select
    n.id,
    n.user_id,
    coalesce(gp.full_name, gp.email, 'Guardian'),
    nullif(n.payload->>'traineeUserId', '')::uuid,
    coalesce(tp.full_name, gl.child_display_name, 'Trainee'),
    coalesce(n.payload->>'eventType', 'unknown'),
    coalesce(n.payload->>'title', n.type),
    coalesce(n.payload->>'body', ''),
    n.created_at,
    n.read_at
  from public.notifications n
  left join public.profiles gp on gp.id = n.user_id
  left join public.profiles tp on tp.id = nullif(n.payload->>'traineeUserId', '')::uuid
  left join public.guardian_links gl
    on gl.guardian_user_id = n.user_id
    and gl.trainee_user_id = nullif(n.payload->>'traineeUserId', '')::uuid
    and gl.status = 'approved'
  where n.type = 'parent_child'
  order by n.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.notify_guardians_for_trainee(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.notify_guardian_check_in(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_guardian_promotion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_guardian_milestone(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_guardian_inactivity_if_needed(uuid) from public, anon, authenticated;
grant execute on function public.get_guardian_children_summary() to authenticated;
grant execute on function public.admin_list_guardian_notification_events(int, int) to authenticated;
