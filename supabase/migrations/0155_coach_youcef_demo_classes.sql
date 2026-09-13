-- Migration 0155: Assign active BJJ classes to Coach Youcef Haibaoui for demonstration
-- Target user: youcefamineh@gmail.com (Coach ID: ffd87f66-a669-456f-888e-0fed2ce590da)

-- 1. Update coach_teaches_class so Coach Youcef has access to real BJJ classes
create or replace function public.coach_teaches_class(p_coach_id uuid, p_class public.classes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    -- Special demo provision ONLY for Coach Youcef Haibaoui:
    (
      p_coach_id = 'ffd87f66-a669-456f-888e-0fed2ce590da'::uuid
      and (
        p_class.discipline_id = '1853a27e-1584-4b8c-91b1-054b1be9db50'::uuid
        or p_class.title ilike '%BJJ%'
      )
    )
    or
    -- Standard check for all other coaches (100% untouched)
    exists (
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
    )
  );
$$;

revoke all on function public.coach_teaches_class(uuid, public.classes) from public;
grant execute on function public.coach_teaches_class(uuid, public.classes) to authenticated;

-- 2. Update get_coach_dashboard to return active BJJ classes with Youcef's coach branding for him
create or replace function public.get_coach_dashboard(p_coach_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_tomorrow date := v_today + 1;
  v_range_start timestamptz := (v_today::text || ' 00:00:00+04')::timestamptz;
  v_range_end timestamptz := (v_tomorrow::text || ' 23:59:59.999+04')::timestamptz;
  v_day_start timestamptz := v_range_start;
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
        'coachName', case
          when v_coach.id = 'ffd87f66-a669-456f-888e-0fed2ce590da'::uuid then 'Youcef Haibaoui'
          else coalesce(c.coach_name, 'Coach')
        end,
        'coachId', case
          when v_coach.id = 'ffd87f66-a669-456f-888e-0fed2ce590da'::uuid then v_coach.id
          else c.coach_id
        end,
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
    and c.starts_at >= v_range_start
    and c.starts_at <= v_range_end
    and public.coach_teaches_class(v_coach.id, c)
    and public.coach_has_discipline_access(v_coach.id, c.discipline_id);

  select count(*)::int
    into v_today_class_count
  from jsonb_array_elements(v_classes) as row
  where (row->>'startsAt')::timestamptz >= v_day_start
    and (row->>'startsAt')::timestamptz <= v_day_end;

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

-- 3. Populate class rosters for active BJJ classes with real members who have profile pictures
do $$
declare
  v_class record;
  v_key text;
  v_member record;
begin
  for v_class in
    select id
    from public.classes
    where is_cancelled = false
      and (discipline_id = '1853a27e-1584-4b8c-91b1-054b1be9db50'::uuid or title ilike '%BJJ%')
      and starts_at >= now() - interval '1 day'
      and starts_at <= now() + interval '7 days'
  loop
    v_key := public.roll_call_list_key_for_class(v_class.id);

    for v_member in
      select id, full_name, avatar_url
      from public.profiles
      where avatar_url is not null
        and avatar_url <> ''
        and role = 'member'
        and id <> '3b3eaf70-8666-48db-a559-6fe9a7e47cf8'::uuid
      order by full_name
      limit 25
    loop
      insert into public.roll_call_class_roster (
        list_key,
        user_id,
        added_by,
        display_name_snapshot,
        avatar_url_snapshot,
        added_at
      )
      values (
        v_key,
        v_member.id,
        '3b3eaf70-8666-48db-a559-6fe9a7e47cf8'::uuid,
        coalesce(v_member.full_name, 'Member'),
        v_member.avatar_url,
        now()
      )
      on conflict (list_key, user_id) do update
        set display_name_snapshot = excluded.display_name_snapshot,
            avatar_url_snapshot = excluded.avatar_url_snapshot,
            added_at = excluded.added_at;
    end loop;
  end loop;
end;
$$;
