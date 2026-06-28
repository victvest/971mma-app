-- Phase 14: promotion candidates for coach queue

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
  candidate_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_cutoff := (timezone('Asia/Dubai', now())::date - interval '14 days') at time zone 'Asia/Dubai';

  return query
  with recent as (
    select
      ci.user_id,
      count(*)::int as recent_check_ins
    from public.check_ins ci
    where ci.checked_in_at >= v_cutoff
    group by ci.user_id
  )
  select
    p.id as user_id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    p.belt_rank,
    p.belt_stripes,
    mbp.percent,
    public.count_training_days(p.id) as training_days,
    coalesce(r.recent_check_ins, 0) as recent_check_ins,
    case
      when mbp.percent >= 100 then 'ready_for_stripe'
      when mbp.percent >= 80 then 'near_ready'
      else 'tracking'
    end as candidate_reason
  from public.member_belt_progress mbp
  join public.profiles p on p.id = mbp.user_id
  join auth.users u on u.id = p.id
  left join recent r on r.user_id = p.id
  where mbp.discipline = p_discipline
    and mbp.percent >= 80
  order by
    case when mbp.percent >= 100 then 0 else 1 end,
    mbp.percent desc,
    coalesce(r.recent_check_ins, 0) desc,
    p.full_name;
end;
$$;

revoke execute on function public.list_promotion_candidates(text) from public, anon;
grant execute on function public.list_promotion_candidates(text) to authenticated;
