-- Phase 13: Belt Path engine — attendance-driven requirements, coach RPCs, tightened writes.

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('coach', 'admin')
  );
$$;

revoke all on function public.is_coach_or_admin() from public;
grant execute on function public.is_coach_or_admin() to authenticated;

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
    ),
    0
  );
$$;

revoke all on function public.count_training_days(uuid) from public;
grant execute on function public.count_training_days(uuid) to authenticated;

create or replace function public.recompute_belt_progress(
  p_user uuid,
  p_discipline text default 'bjj'
)
returns public.member_belt_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank_id uuid;
  v_rank_name text;
  v_rank_stripes int;
  v_progress public.member_belt_progress%rowtype;
  v_training_days int;
  v_done_count int := 0;
  v_total_count int := 0;
  v_req record;
  v_existing_status text;
  v_unlocked boolean;
  v_next_status text;
begin
  if p_user is null then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'User is required.';
  end if;

  select id, name, stripes
    into v_rank_id, v_rank_name, v_rank_stripes
  from public.belt_ranks
  where discipline = p_discipline
  order by "order"
  limit 1;

  if v_rank_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Belt curriculum not found.';
  end if;

  insert into public.member_belt_progress (user_id, discipline, rank_id, stripe, percent, updated_at)
  values (p_user, p_discipline, v_rank_id, 0, 0, now())
  on conflict (user_id, discipline) do nothing;

  select *
    into v_progress
  from public.member_belt_progress
  where user_id = p_user
    and discipline = p_discipline
  for update;

  if v_progress.rank_id is not null then
    select name, stripes
      into v_rank_name, v_rank_stripes
    from public.belt_ranks
    where id = v_progress.rank_id;
  else
    v_progress.rank_id := v_rank_id;
    v_rank_name := coalesce(v_rank_name, 'White');
  end if;

  v_training_days := public.count_training_days(p_user);

  for v_req in
    select id, stripe, type, attendance_target, unlock_after_stripe
    from public.belt_requirements
    where rank_id = v_progress.rank_id
    order by stripe, title
  loop
    v_total_count := v_total_count + 1;
    v_unlocked := coalesce(v_req.unlock_after_stripe, 0) <= v_progress.stripe;

    select status
      into v_existing_status
    from public.member_requirement_status
    where user_id = p_user
      and requirement_id = v_req.id;

    if v_req.type = 'attendance' then
      if v_training_days >= coalesce(v_req.attendance_target, 2147483647) then
        v_next_status := 'done';
      elsif v_unlocked then
        v_next_status := 'now';
      else
        v_next_status := 'locked';
      end if;
    else
      if not v_unlocked then
        v_next_status := 'locked';
      elsif v_existing_status = 'done' then
        v_next_status := 'done';
      else
        v_next_status := coalesce(v_existing_status, 'now');
      end if;
    end if;

    insert into public.member_requirement_status (
      user_id,
      requirement_id,
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
      case when v_req.type = 'attendance' and v_next_status = 'done' then now() else null end,
      now()
    )
    on conflict (user_id, requirement_id) do update
    set status = excluded.status,
        updated_at = now(),
        assessed_by = member_requirement_status.assessed_by,
        assessed_at = case
          when v_req.type = 'attendance' and excluded.status = 'done' then coalesce(member_requirement_status.assessed_at, now())
          else member_requirement_status.assessed_at
        end;

    if v_next_status = 'done' then
      v_done_count := v_done_count + 1;
    end if;
  end loop;

  update public.member_belt_progress
  set rank_id = v_progress.rank_id,
      percent = case
        when v_total_count = 0 then 0
        else round((v_done_count::numeric / v_total_count::numeric) * 100, 2)
      end,
      updated_at = now()
  where user_id = p_user
    and discipline = p_discipline
  returning * into v_progress;

  update public.profiles
  set belt_rank = v_rank_name,
      belt_stripes = v_progress.stripe,
      updated_at = now()
  where id = p_user;

  return v_progress;
end;
$$;

create or replace function public.mark_requirement_status(
  p_user uuid,
  p_requirement uuid,
  p_status text
)
returns public.member_requirement_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.member_requirement_status%rowtype;
  v_req public.belt_requirements%rowtype;
  v_progress public.member_belt_progress%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_status not in ('now', 'done') then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Status must be now or done.';
  end if;

  select *
    into v_req
  from public.belt_requirements
  where id = p_requirement;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Requirement not found.';
  end if;

  if v_req.type = 'attendance' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Attendance requirements are computed from check-ins.';
  end if;

  select *
    into v_progress
  from public.member_belt_progress
  where user_id = p_user
    and discipline = (
      select discipline from public.belt_ranks where id = v_req.rank_id
    );

  if coalesce(v_req.unlock_after_stripe, 0) > coalesce(v_progress.stripe, 0) then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Requirement is still locked for this member.';
  end if;

  insert into public.member_requirement_status (
    user_id,
    requirement_id,
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
  on conflict (user_id, requirement_id) do update
  set status = excluded.status,
      assessed_by = auth.uid(),
      assessed_at = now(),
      updated_at = now()
  returning * into v_row;

  perform public.recompute_belt_progress(
    p_user,
    (select discipline from public.belt_ranks where id = v_req.rank_id)
  );

  return v_row;
end;
$$;

create or replace function public.award_promotion(
  p_user uuid,
  p_discipline text default 'bjj',
  p_to_stripe int default null,
  p_to_rank uuid default null
)
returns public.promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.member_belt_progress%rowtype;
  v_from_rank uuid;
  v_from_stripe int;
  v_to_rank uuid;
  v_to_stripe int;
  v_rank_stripes int;
  v_promotion public.promotions%rowtype;
  v_rank_name text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_belt_progress
  where user_id = p_user
    and discipline = p_discipline
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Member belt progress not found.';
  end if;

  v_from_rank := v_progress.rank_id;
  v_from_stripe := v_progress.stripe;
  v_to_rank := coalesce(p_to_rank, v_progress.rank_id);
  v_to_stripe := coalesce(p_to_stripe, v_progress.stripe + 1);

  select stripes, name
    into v_rank_stripes, v_rank_name
  from public.belt_ranks
  where id = v_to_rank;

  if v_to_rank = v_progress.rank_id and v_to_stripe > v_rank_stripes then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Stripe exceeds rank maximum.';
  end if;

  if v_to_rank = v_progress.rank_id and v_to_stripe <= v_progress.stripe then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Promotion must advance stripe or rank.';
  end if;

  insert into public.promotions (
    user_id,
    discipline,
    from_rank,
    to_rank,
    from_stripe,
    to_stripe,
    awarded_by,
    awarded_at
  )
  values (
    p_user,
    p_discipline,
    v_from_rank,
    v_to_rank,
    v_from_stripe,
    v_to_stripe,
    auth.uid(),
    now()
  )
  returning * into v_promotion;

  update public.member_belt_progress
  set rank_id = v_to_rank,
      stripe = v_to_stripe,
      updated_at = now()
  where user_id = p_user
    and discipline = p_discipline;

  if v_to_rank <> v_from_rank then
    select name into v_rank_name from public.belt_ranks where id = v_to_rank;
  end if;

  update public.profiles
  set belt_rank = v_rank_name,
      belt_stripes = v_to_stripe,
      updated_at = now()
  where id = p_user;

  perform public.recompute_belt_progress(p_user, p_discipline);

  return v_promotion;
end;
$$;

create or replace function public.coach_search_members(p_query text)
returns table (
  id uuid,
  full_name text,
  email text,
  belt_rank text,
  belt_stripes int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_query is null then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    p.belt_rank,
    p.belt_stripes
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.full_name ilike '%' || v_query || '%'
     or u.email ilike '%' || v_query || '%'
  order by p.full_name
  limit 20;
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
      raise warning 'Phase 7/13 non-critical recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

-- Members must not directly mutate belt progression rows; coaches/admins use RPCs.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'member_belt_progress',
        'member_requirement_status',
        'promotions'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke execute on function public.recompute_belt_progress(uuid, text) from public, anon;
grant execute on function public.recompute_belt_progress(uuid, text) to authenticated;
revoke execute on function public.mark_requirement_status(uuid, uuid, text) from public, anon;
grant execute on function public.mark_requirement_status(uuid, uuid, text) to authenticated;
revoke execute on function public.award_promotion(uuid, text, int, uuid) from public, anon;
grant execute on function public.award_promotion(uuid, text, int, uuid) to authenticated;
revoke execute on function public.coach_search_members(text) from public, anon;
grant execute on function public.coach_search_members(text) to authenticated;
