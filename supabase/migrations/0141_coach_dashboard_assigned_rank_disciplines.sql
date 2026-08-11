-- Coach dashboard promotion queue should follow the coach's assigned rank disciplines.

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

  with assigned_rank_disciplines as (
    select d.slug
    from public.coach_disciplines cd
    join public.disciplines d on d.id = cd.discipline_id
    where cd.coach_id = v_coach.id
      and d.active = true
      and d.has_rank_progression = true
      and d.slug in ('bjj', 'wrestling')
  ),
  promotion_disciplines as (
    select slug from assigned_rank_disciplines
    union all
    select 'bjj'
    where not exists (select 1 from assigned_rank_disciplines)
  )
  select count(*)::int
    into v_promotion_candidate_count
  from promotion_disciplines pd
  cross join lateral public.list_promotion_candidates(pd.slug) c
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

revoke execute on function public.get_coach_dashboard(uuid) from public, anon;
grant execute on function public.get_coach_dashboard(uuid) to authenticated;
