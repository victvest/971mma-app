-- Today attendance audience for the dashboard Training today drill-down.

create or replace function public.admin_list_today_attendees(
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  user_id uuid,
  full_name text,
  role text,
  account_status text,
  membership_status text,
  phone text,
  avatar_url text,
  created_at timestamptz,
  email text,
  mindbody_client_id text,
  points_balance int,
  last_visit_at timestamptz,
  days_away int,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := timezone('Asia/Dubai', now())::date;
  v_start timestamptz := v_today::timestamp at time zone 'Asia/Dubai';
  v_end timestamptz := (v_today + 1)::timestamp at time zone 'Asia/Dubai';
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();

  return query
  with attendees as (
    select
      p.id as user_id,
      p.full_name,
      p.role,
      p.account_status,
      p.membership_status,
      p.phone,
      p.avatar_url,
      p.created_at,
      u.email::text,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0)::int as points_balance,
      max(ci.checked_in_at) as last_visit_at
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.check_ins ci on ci.user_id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    where p.role in ('member', 'guest')
      and ci.checked_in_at >= v_start
      and ci.checked_in_at < v_end
      and ci.signed_in = true
      and ci.missed = false
      and ci.late_cancelled = false
      and u.email::text not ilike '%@privaterelay.appleid.com'
      and (
        v_query is null
        or p.id::text = v_query
        or p.full_name ilike '%' || v_query || '%'
        or u.email::text ilike '%' || v_query || '%'
        or p.phone ilike '%' || v_query || '%'
        or ml.mindbody_client_id ilike '%' || v_query || '%'
      )
    group by p.id, p.full_name, p.role, p.account_status, p.membership_status,
      p.phone, p.avatar_url, p.created_at, u.email, ml.mindbody_client_id, pa.balance
  ), counted as (
    select attendees.*, count(*) over () as total_count
    from attendees
  )
  select
    counted.user_id,
    counted.full_name,
    counted.role,
    counted.account_status,
    counted.membership_status,
    counted.phone,
    counted.avatar_url,
    counted.created_at,
    counted.email,
    counted.mindbody_client_id,
    counted.points_balance,
    counted.last_visit_at,
    0::int as days_away,
    counted.total_count
  from counted
  order by counted.last_visit_at desc, counted.full_name, counted.user_id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_today_attendees(text, int, int) from public, anon;
grant execute on function public.admin_list_today_attendees(text, int, int) to authenticated;
