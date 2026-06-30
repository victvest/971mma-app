-- Include member phone on activation queue rows for admin Mindbody client creation.

drop function if exists public.admin_list_activation_requests(text, int, int);

create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  full_name text,
  email text,
  phone text,
  account_status text,
  mindbody_client_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(p_status), '');
begin
  perform public.require_admin();

  return query
  select
    ar.id,
    ar.user_id,
    ar.status,
    ar.requested_at,
    ar.resolved_at,
    p.full_name,
    u.email::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), '')) as phone,
    p.account_status,
    ml.mindbody_client_id
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where v_status is null or ar.status = v_status
  order by
    case when ar.status = 'pending' then 0 else 1 end,
    ar.requested_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int) from public;
grant execute on function public.admin_list_activation_requests(text, int, int) to authenticated;
