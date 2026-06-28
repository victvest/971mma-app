-- Phase 5: consolidated member Home dashboard summary.

create or replace function public.get_member_home_dashboard(p_user uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_points public.points_accounts%rowtype;
  v_score public.discipline_scores%rowtype;
  v_progress public.member_belt_progress%rowtype;
  v_rank public.belt_ranks%rowtype;
  v_training_days int := 0;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_day_start timestamptz := v_today::timestamp at time zone 'Asia/Dubai';
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone 'Asia/Dubai') - interval '1 millisecond';
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

  perform public.recompute_belt_progress(v_user, 'bjj');
  v_training_days := public.count_training_days(v_user);

  select *
    into v_points
  from public.points_accounts
  where user_id = v_user;

  select *
    into v_score
  from public.discipline_scores
  where user_id = v_user;

  select *
    into v_progress
  from public.member_belt_progress
  where user_id = v_user
    and discipline = 'bjj';

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
    where discipline = 'bjj'
    order by "order" asc
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'discipline', c.discipline,
        'description', c.description,
        'coachName', coalesce(c.coach_name, 'Coach'),
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
      and starts_at >= v_day_start
      and starts_at <= v_day_end
      and starts_at + (duration_minutes * interval '1 minute') > now()
    order by starts_at asc
    limit 3
  ) c;

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
      'trainingDays', coalesce((v_score.components->>'trainingDays')::numeric, 0),
      'trainingDays30d', coalesce((v_score.components->>'trainingDays30d')::numeric, 0),
      'monthlyGoalPct', coalesce((v_score.components->>'monthlyGoalPct')::numeric, 0),
      'computedAt', v_score.computed_at,
      'isPlaceholderWeights', coalesce((v_score.components->>'weightsPlaceholder')::boolean, false)
    ),
    'weekActivity', v_week,
    'beltProgress', jsonb_build_object(
      'userId', v_user,
      'discipline', 'bjj',
      'rankId', coalesce(v_progress.rank_id, v_rank.id),
      'rankName', coalesce(v_rank.name, 'White'),
      'stripe', coalesce(v_progress.stripe, 0),
      'maxStripes', coalesce(v_rank.stripes, 4),
      'percent', coalesce(v_progress.percent, 0),
      'trainingDays', v_training_days,
      'updatedAt', coalesce(v_progress.updated_at, now())
    )
  );
end;
$$;

revoke all on function public.get_member_home_dashboard(uuid) from public, anon;
grant execute on function public.get_member_home_dashboard(uuid) to authenticated;
