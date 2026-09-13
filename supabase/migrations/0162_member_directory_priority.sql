-- 0162_member_directory_priority.sql
-- Priority in member listing for members who are in the app, active Mindbody, and active membership.

create or replace function public.admin_list_app_member_directory(
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_role text default null,
  p_linked_filter text default 'all',
  p_membership_filter text default 'all',
  p_order text default 'recent'
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
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_linked_filter text := lower(coalesce(nullif(trim(p_linked_filter), ''), 'all'));
  v_membership_filter text := lower(coalesce(nullif(trim(p_membership_filter), ''), 'all'));
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'recent'));
begin
  perform public.require_admin();

  if v_role is not null and v_role not in ('admin', 'coach', 'member', 'guest') then
    v_role := null;
  end if;

  if v_linked_filter not in ('all', 'linked', 'unlinked') then
    v_linked_filter := 'all';
  end if;

  if v_membership_filter not in ('all', 'active', 'inactive') then
    v_membership_filter := 'all';
  end if;

  if v_order not in ('recent', 'points') then
    v_order := 'recent';
  end if;

  return query
  with filtered as (
    select
      p.id as user_id,
      p.full_name,
      p.role,
      p.account_status,
      case
        when uam.is_active = true then 'active'
        when ml.mindbody_client_id is not null then p.membership_status
        else null
      end as membership_status,
      p.phone,
      p.avatar_url,
      p.created_at,
      u.email::text as email,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0)::int as points_balance,
      count(*) over () as total_count
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    left join public.unlimited_access_members uam on uam.user_id = p.id and uam.is_active = true
    where u.email::text not ilike '%@privaterelay.appleid.com'
      and (v_role is null or p.role = v_role)
      and (
        v_linked_filter = 'all'
        or (v_linked_filter = 'linked' and ml.user_id is not null)
        or (v_linked_filter = 'unlinked' and ml.user_id is null)
      )
      and (
        v_membership_filter = 'all'
        or (
          v_membership_filter = 'active'
          and (
            uam.is_active = true
            or (ml.mindbody_client_id is not null and lower(coalesce(p.membership_status, '')) in ('active', 'current'))
          )
        )
        or (
          v_membership_filter = 'inactive'
          and not (
            uam.is_active = true
            or (ml.mindbody_client_id is not null and lower(coalesce(p.membership_status, '')) in ('active', 'current'))
          )
        )
      )
      and (
        v_query is null
        or p.id::text = v_query
        or p.full_name ilike '%' || v_query || '%'
        or u.email::text ilike '%' || v_query || '%'
        or p.phone ilike '%' || v_query || '%'
        or ml.mindbody_client_id ilike '%' || v_query || '%'
      )
  )
  select
    filtered.user_id,
    filtered.full_name,
    filtered.role,
    filtered.account_status,
    filtered.membership_status,
    filtered.phone,
    filtered.avatar_url,
    filtered.created_at,
    filtered.email,
    filtered.mindbody_client_id,
    filtered.points_balance,
    filtered.total_count
  from filtered
  order by
    -- PRIORITY: Members who are in the app, linked to Mindbody, and have active membership
    case
      when filtered.mindbody_client_id is not null
       and lower(coalesce(filtered.membership_status, '')) in ('active', 'current')
      then 0
      when filtered.mindbody_client_id is not null then 1
      else 2
    end asc,
    case when v_order = 'points' then filtered.points_balance end desc,
    case when v_order = 'recent' then filtered.created_at end desc,
    filtered.user_id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_app_member_directory(text, int, int, text, text, text, text) from public, anon;
grant execute on function public.admin_list_app_member_directory(text, int, int, text, text, text, text) to authenticated;
