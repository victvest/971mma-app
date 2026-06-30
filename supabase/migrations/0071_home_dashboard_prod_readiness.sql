-- Home dashboard production readiness:
-- 1. Recompute discipline score (incl. streak/grace) on every dashboard read
-- 2. Limit upcoming classes to gym-local today + tomorrow
-- 3. Filter upcoming classes to enrolled disciplines when member has active enrollments

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
  v_has_enrollments boolean := false;
begin
  if auth.uid() is null then
    raise exception using message = 'Not authenticated', errcode = 'P0001';
  end if;

  if v_user is null or not public.can_read_member_data(v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  perform public.rebuild_points_balance_cache(v_user);
  perform public.recompute_discipline_score(v_user);

  select exists (
    select 1
    from public.member_disciplines md
    join public.disciplines d on d.id = md.discipline_id
    where md.user_id = v_user
      and md.active = true
      and d.active = true
  )
    into v_has_enrollments;

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
    select c.*
    from public.classes c
    where c.mindbody_class_id is not null
      and c.is_cancelled = false
      and c.starts_at + (c.duration_minutes * interval '1 minute') > now()
      and (c.starts_at at time zone 'Asia/Dubai')::date between v_today and v_today + 1
      and (
        not v_has_enrollments
        or c.discipline_id in (
          select md.discipline_id
          from public.member_disciplines md
          join public.disciplines d on d.id = md.discipline_id
          where md.user_id = v_user
            and md.active = true
            and d.active = true
        )
      )
    order by c.starts_at asc
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
