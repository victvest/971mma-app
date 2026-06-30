-- Coach-managed rank curriculum for assigned BJJ/Wrestling disciplines.

create or replace function public.assert_coach_rank_discipline_access(p_discipline_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_coach_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if p_discipline_slug not in ('bjj', 'wrestling') then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select d.id
    into v_discipline_id
  from public.disciplines d
  where d.slug = p_discipline_slug
    and d.has_rank_progression = true
    and d.active = true;

  if v_discipline_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return v_discipline_id;
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_coach_id := public.coach_id_for_user();
  if v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.coach_has_discipline_access(v_coach_id, v_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return v_discipline_id;
end;
$$;

create or replace function public.list_coach_rank_curriculum(p_discipline_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_ranks jsonb;
  v_requirements jsonb;
begin
  v_discipline_id := public.assert_coach_rank_discipline_access(p_discipline_slug);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rl.id,
        'name', rl.name,
        'order', rl.level_order,
        'stripes', rl.stripe_count
      )
      order by rl.level_order
    ),
    '[]'::jsonb
  )
  into v_ranks
  from public.rank_levels rl
  join public.rank_systems rs on rs.id = rl.rank_system_id
  where rs.discipline_id = v_discipline_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rr.id,
        'rankLevelId', rr.rank_level_id,
        'rankName', rl.name,
        'stripe', rr.stripe,
        'title', rr.title,
        'description', rr.description,
        'requirementType', rr.requirement_type,
        'attendanceTarget', rr.attendance_target,
        'sortOrder', rr.sort_order
      )
      order by rl.level_order, rr.stripe, rr.sort_order, rr.title
    ),
    '[]'::jsonb
  )
  into v_requirements
  from public.rank_requirements rr
  join public.rank_levels rl on rl.id = rr.rank_level_id
  join public.rank_systems rs on rs.id = rl.rank_system_id
  where rs.discipline_id = v_discipline_id;

  return jsonb_build_object(
    'disciplineSlug', p_discipline_slug,
    'ranks', v_ranks,
    'requirements', v_requirements
  );
end;
$$;

create or replace function public.upsert_coach_rank_requirement(
  p_discipline_slug text,
  p_rank_level_id uuid,
  p_stripe int,
  p_title text,
  p_description text default null,
  p_requirement_type text default 'skill',
  p_attendance_target int default null,
  p_sort_order int default 0,
  p_requirement_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_type text := coalesce(nullif(trim(coalesce(p_requirement_type, '')), ''), 'skill');
  v_row public.rank_requirements%rowtype;
begin
  v_discipline_id := public.assert_coach_rank_discipline_access(p_discipline_slug);

  if v_title = '' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_type not in ('attendance', 'skill', 'assessment') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_stripe is null or p_stripe < 0 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.rank_levels rl
    join public.rank_systems rs on rs.id = rl.rank_system_id
    where rl.id = p_rank_level_id
      and rs.discipline_id = v_discipline_id
  ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_requirement_id is null then
    insert into public.rank_requirements (
      rank_level_id,
      stripe,
      title,
      description,
      requirement_type,
      attendance_target,
      sort_order
    )
    values (
      p_rank_level_id,
      p_stripe,
      v_title,
      nullif(trim(coalesce(p_description, '')), ''),
      v_type,
      p_attendance_target,
      coalesce(p_sort_order, 0)
    )
    returning * into v_row;
  else
    update public.rank_requirements rr
    set rank_level_id = p_rank_level_id,
        stripe = p_stripe,
        title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        requirement_type = v_type,
        attendance_target = p_attendance_target,
        sort_order = coalesce(p_sort_order, 0),
        updated_at = now()
    from public.rank_levels rl
    join public.rank_systems rs on rs.id = rl.rank_system_id
    where rr.id = p_requirement_id
      and rr.rank_level_id = rl.id
      and rs.discipline_id = v_discipline_id
    returning rr.* into v_row;

    if v_row.id is null then
      raise exception using message = 'NOT_FOUND', errcode = 'P0001';
    end if;
  end if;

  return public.list_coach_rank_curriculum(p_discipline_slug);
end;
$$;

create or replace function public.delete_coach_rank_requirement(p_requirement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_slug text;
begin
  if p_requirement_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select d.slug
    into v_discipline_slug
  from public.rank_requirements rr
  join public.rank_levels rl on rl.id = rr.rank_level_id
  join public.rank_systems rs on rs.id = rl.rank_system_id
  join public.disciplines d on d.id = rs.discipline_id
  where rr.id = p_requirement_id;

  if v_discipline_slug is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.assert_coach_rank_discipline_access(v_discipline_slug);

  delete from public.rank_requirements where id = p_requirement_id;

  return public.list_coach_rank_curriculum(v_discipline_slug);
end;
$$;

revoke all on function public.assert_coach_rank_discipline_access(text) from public;
grant execute on function public.assert_coach_rank_discipline_access(text) to authenticated;

revoke all on function public.list_coach_rank_curriculum(text) from public;
grant execute on function public.list_coach_rank_curriculum(text) to authenticated;

revoke all on function public.upsert_coach_rank_requirement(text, uuid, int, text, text, text, int, int, uuid) from public;
grant execute on function public.upsert_coach_rank_requirement(text, uuid, int, text, text, text, int, int, uuid) to authenticated;

revoke all on function public.delete_coach_rank_requirement(uuid) from public;
grant execute on function public.delete_coach_rank_requirement(uuid) to authenticated;
