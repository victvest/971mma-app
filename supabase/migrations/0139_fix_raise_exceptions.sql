-- Fix raise exception syntax error "RAISE option already specified: MESSAGE" in belt/promotion RPCs.
-- Position-based string arguments in raise exception cannot be combined with "using message = ...".

create or replace function public.recompute_belt_progress(
  p_user uuid,
  p_discipline text default 'bjj'
)
returns public.member_rank_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_rank_system_id uuid;
  v_rank_level_id uuid;
  v_rank_name text;
  v_rank_stripes int;
  v_progress public.member_rank_progress%rowtype;
  v_training_days int;
  v_done_count int := 0;
  v_total_count int := 0;
  v_req record;
  v_existing_status text;
  v_unlocked boolean;
  v_next_status text;
begin
  if p_user is null then
    raise exception using errcode = 'P0001', message = 'User is required.';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  select id into v_rank_system_id from public.rank_systems where discipline_id = v_discipline_id;
  if v_rank_system_id is null then
    raise exception using errcode = 'P0001', message = 'Rank system not found for this discipline.';
  end if;

  select id, name, stripe_count
    into v_rank_level_id, v_rank_name, v_rank_stripes
  from public.rank_levels
  where rank_system_id = v_rank_system_id
  order by level_order
  limit 1;

  if v_rank_level_id is null then
    raise exception using errcode = 'P0001', message = 'Rank levels not found.';
  end if;

  insert into public.member_rank_progress (user_id, discipline_id, rank_level_id, stripe, percent_complete, updated_at)
  values (p_user, v_discipline_id, v_rank_level_id, 0, 0, now())
  on conflict (user_id, discipline_id) do nothing;

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if v_progress.rank_level_id is not null then
    select name, stripe_count
      into v_rank_name, v_rank_stripes
    from public.rank_levels
    where id = v_progress.rank_level_id;
  else
    v_progress.rank_level_id := v_rank_level_id;
    v_rank_name := coalesce(v_rank_name, 'White');
  end if;

  v_training_days := public.count_discipline_training_days(p_user, v_discipline_id);

  for v_req in
    select id, stripe, requirement_type, attendance_target, sort_order
    from public.rank_requirements
    where rank_level_id = v_progress.rank_level_id
    order by stripe, sort_order, title
  loop
    v_total_count := v_total_count + 1;
    v_unlocked := (v_progress.stripe >= v_req.stripe - 1);

    select status
      into v_existing_status
    from public.member_requirement_statuses
    where user_id = p_user
      and rank_requirement_id = v_req.id;

    if v_req.requirement_type = 'attendance' then
      if v_training_days >= coalesce(v_req.attendance_target, 2147483647) then
        v_next_status := 'done';
      elsif v_unlocked then
        v_next_status := 'next';
      else
        v_next_status := 'locked';
      end if;
    else
      if not v_unlocked then
        v_next_status := 'locked';
      elsif v_existing_status = 'done' then
        v_next_status := 'done';
      else
        v_next_status := coalesce(v_existing_status, 'next');
      end if;
    end if;

    insert into public.member_requirement_statuses (
      user_id,
      rank_requirement_id,
      status,
      assessed_by,
      assessed_at,
      updated_at
    )
    values (
      p_user,
      v_req.id,
      v_next_status,
      null::uuid,
      case when v_req.requirement_type = 'attendance' and v_next_status = 'done' then now() else null end,
      now()
    )
    on conflict (user_id, rank_requirement_id) do update
    set status = excluded.status,
        updated_at = now(),
        assessed_by = member_requirement_statuses.assessed_by,
        assessed_at = case
          when v_req.requirement_type = 'attendance' and excluded.status = 'done' then coalesce(member_requirement_statuses.assessed_at, now())
          else member_requirement_statuses.assessed_at
        end;

    if v_next_status = 'done' then
      v_done_count := v_done_count + 1;
    end if;
  end loop;

  update public.member_rank_progress
  set rank_level_id = v_progress.rank_level_id,
      percent_complete = case
        when v_total_count = 0 then 0
        else round((v_done_count::numeric / v_total_count::numeric) * 100, 2)
      end,
      updated_at = now()
  where user_id = p_user
    and discipline_id = v_discipline_id
  returning * into v_progress;

  if p_discipline = 'bjj' then
    update public.profiles
    set belt_rank = v_rank_name,
        belt_stripes = v_progress.stripe,
        updated_at = now()
    where id = p_user;
  end if;

  return v_progress;
end;
$$;

create or replace function public.mark_requirement_status(
  p_user uuid,
  p_requirement uuid,
  p_status text
)
returns public.member_requirement_statuses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.member_requirement_statuses%rowtype;
  v_req public.rank_requirements%rowtype;
  v_progress public.member_rank_progress%rowtype;
  v_discipline_slug text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_status not in ('next', 'done') then
    raise exception using errcode = 'P0001', message = 'Status must be next or done.';
  end if;

  select *
    into v_req
  from public.rank_requirements
  where id = p_requirement;

  if not found then
    raise exception using errcode = 'P0001', message = 'Requirement not found.';
  end if;

  if v_req.requirement_type = 'attendance' then
    raise exception using errcode = 'P0001', message = 'Attendance requirements are computed from check-ins.';
  end if;

  select d.slug into v_discipline_slug
  from public.rank_levels rl
  join public.rank_systems rs on rs.id = rl.rank_system_id
  join public.disciplines d on d.id = rs.discipline_id
  where rl.id = v_req.rank_level_id;

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and rank_level_id = v_req.rank_level_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Member progress not found for this rank level.';
  end if;

  if v_progress.stripe < v_req.stripe - 1 then
    raise exception using errcode = 'P0001', message = 'Requirement is still locked for this member.';
  end if;

  insert into public.member_requirement_statuses (
    user_id,
    rank_requirement_id,
    status,
    assessed_by,
    assessed_at,
    updated_at
  )
  values (
    p_user,
    p_requirement,
    p_status,
    auth.uid(),
    now(),
    now()
  )
  on conflict (user_id, rank_requirement_id) do update
  set status = excluded.status,
      assessed_by = auth.uid(),
      assessed_at = now(),
      updated_at = now()
  returning * into v_row;

  perform public.recompute_belt_progress(p_user, v_discipline_slug);

  return v_row;
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
  v_has_discipline boolean;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    raise exception using errcode = 'P0001', message = 'Rank progression only exists for BJJ and Wrestling.';
  end if;

  -- Ensure member has an active discipline record (auto-enroll if not already active)
  select exists (
    select 1 from public.member_disciplines
    where user_id = p_user
      and discipline_id = v_discipline_id
      and active = true
  ) into v_has_discipline;

  if not v_has_discipline then
    update public.member_disciplines
    set active = true, updated_at = now()
    where user_id = p_user
      and discipline_id = v_discipline_id
      and source = 'admin_override';

    if not found then
      insert into public.member_disciplines (user_id, discipline_id, source, active, starts_on)
      values (p_user, v_discipline_id, 'admin_override', true, now()::date);
    end if;
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    if not exists (
      select 1 from public.coach_disciplines cd
      join public.coaches c on c.id = cd.coach_id
      where c.user_id = auth.uid()
        and cd.discipline_id = v_discipline_id
    ) then
      raise exception using errcode = 'P0001', message = 'Coach is not assigned to this discipline.';
    end if;
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Member rank progress not found.';
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
    raise exception using errcode = 'P0001', message = 'Stripe exceeds rank maximum.';
  end if;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe <= v_progress.stripe then
    raise exception using errcode = 'P0001', message = 'Promotion must advance stripe or rank.';
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
    perform public.notify_member_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Member promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  begin
    perform public.notify_guardian_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Guardian promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  return v_promotion;
end;
$$;
