-- Fix recompute_belt_progress typed nulls for assessed_by (uuid).

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
          when v_req.type = 'attendance' and excluded.status = 'done'
            then coalesce(member_requirement_status.assessed_at, now())
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
