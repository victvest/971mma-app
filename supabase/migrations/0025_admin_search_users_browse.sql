-- Allow admin member directory to browse paginated users without a search query.

create or replace function public.admin_search_users(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  mindbody_client_id text,
  points_balance int,
  attendance_count bigint,
  membership_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();

  if v_query is null then
    return query
    select
      p.id,
      coalesce(p.full_name, 'Member') as full_name,
      u.email::text,
      p.role,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0) as points_balance,
      (
        select count(*)::bigint
        from public.check_ins ci
        where ci.user_id = p.id
      ) as attendance_count,
      p.membership_status,
      p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    order by p.created_at desc
    limit v_limit
    offset v_offset;
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, 'Member') as full_name,
    u.email::text,
    p.role,
    ml.mindbody_client_id,
    coalesce(pa.balance, 0) as points_balance,
    (
      select count(*)::bigint
      from public.check_ins ci
      where ci.user_id = p.id
    ) as attendance_count,
    p.membership_status,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  left join public.points_accounts pa on pa.user_id = p.id
  where p.full_name ilike '%' || v_query || '%'
     or u.email ilike '%' || v_query || '%'
     or ml.mindbody_client_id ilike '%' || v_query || '%'
  order by p.full_name
  limit v_limit
  offset v_offset;
end;
$$;
