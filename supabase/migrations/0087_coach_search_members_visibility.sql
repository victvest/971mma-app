-- Belt review / coach member search: include members without synced discipline entitlements.
-- Registered members only had profiles rows until Mindbody membership sync populated member_disciplines,
-- so email/name matches were hidden from coaches with assigned disciplines.

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
  v_coach_id uuid;
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

  v_coach_id := public.coach_id_for_user();

  return query
  select
    p.id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    coalesce(rank_progress.name, p.belt_rank) as belt_rank,
    coalesce(rank_progress.stripe, p.belt_stripes) as belt_stripes
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  left join lateral (
    select mrp.stripe, rl.name
    from public.member_rank_progress mrp
    join public.rank_levels rl on rl.id = mrp.rank_level_id
    join public.disciplines d on d.id = mrp.discipline_id
    where mrp.user_id = p.id
    order by case when d.slug = 'bjj' then 1 else 2 end
    limit 1
  ) rank_progress on true
  where p.role = 'member'
    and (
      p.full_name ilike '%' || v_query || '%'
      or u.email ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
    )
    and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      or v_coach_id is null
      or not exists (select 1 from public.coach_disciplines cd where cd.coach_id = v_coach_id)
      or not exists (
        select 1
        from public.member_disciplines md
        where md.user_id = p.id
          and md.active = true
      )
      or exists (
        select 1
        from public.member_disciplines md
        join public.coach_disciplines cd on cd.discipline_id = md.discipline_id
        where md.user_id = p.id
          and md.active = true
          and cd.coach_id = v_coach_id
      )
    )
  order by p.full_name
  limit 20;
end;
$$;

grant execute on function public.coach_search_members(text) to authenticated;
