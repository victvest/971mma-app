-- Include member avatar URLs in promotion candidate list for coach belt review UI.

drop function if exists public.list_promotion_candidates(text);

create or replace function public.list_promotion_candidates(p_discipline text default 'bjj')
returns table (
  user_id uuid,
  full_name text,
  email text,
  belt_rank text,
  belt_stripes int,
  percent numeric,
  training_days int,
  recent_check_ins int,
  candidate_reason text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_discipline_id uuid;
  v_coach_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    return;
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    v_coach_id := public.coach_id_for_user();
    if v_coach_id is null then
      return;
    end if;

    if not public.coach_has_discipline_access(v_coach_id, v_discipline_id) then
      return;
    end if;
  end if;

  v_cutoff := (timezone('Asia/Dubai', now())::date - interval '14 days') at time zone 'Asia/Dubai';

  return query
  with recent as (
    select
      ci.user_id,
      count(*)::int as recent_check_ins
    from public.check_ins ci
    left join public.classes c on c.id = ci.class_id
    where ci.checked_in_at >= v_cutoff
      and ci.signed_in = true
      and ci.missed = false
      and ci.late_cancelled = false
      and (c.discipline_id = v_discipline_id or ci.class_id is null)
    group by ci.user_id
  )
  select
    p.id as user_id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    rl.name as belt_rank,
    mrp.stripe as belt_stripes,
    mrp.percent_complete as percent,
    public.count_discipline_training_days(p.id, v_discipline_id) as training_days,
    coalesce(r.recent_check_ins, 0) as recent_check_ins,
    case
      when mrp.percent_complete >= 100 then 'ready_for_stripe'
      when mrp.percent_complete >= 80 then 'near_ready'
      else 'tracking'
    end as candidate_reason,
    p.avatar_url
  from public.member_rank_progress mrp
  join public.rank_levels rl on rl.id = mrp.rank_level_id
  join public.profiles p on p.id = mrp.user_id
  join auth.users u on u.id = p.id
  left join recent r on r.user_id = p.id
  where mrp.discipline_id = v_discipline_id
    and mrp.percent_complete >= 80
  order by
    case when mrp.percent_complete >= 100 then 0 else 1 end,
    mrp.percent_complete desc,
    coalesce(r.recent_check_ins, 0) desc,
    p.full_name;
end;
$$;
