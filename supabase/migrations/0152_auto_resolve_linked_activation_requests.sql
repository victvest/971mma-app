-- Auto-resolve activation requests when members are active or linked to Mindbody
-- Prevents already active / linked members (e.g. Saif Bustami) from lingering in "Needs action"

-- 1. One-time resolution of pending requests for members who are already active or linked
update public.activation_requests ar
set status = 'resolved',
    resolved_at = coalesce(ar.resolved_at, now())
from public.profiles p
where ar.user_id = p.id
  and ar.status = 'pending'
  and (
    p.account_status = 'active'
    or exists (
      select 1 from public.mindbody_links ml
      where ml.user_id = ar.user_id
        and nullif(trim(ml.mindbody_client_id), '') is not null
    )
  );

-- 2. Trigger on mindbody_links to auto-resolve activation requests
create or replace function public.trig_auto_resolve_activation_on_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(new.mindbody_client_id), '') is not null then
    update public.activation_requests
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now())
    where user_id = new.user_id
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_mindbody_links_auto_resolve_activation on public.mindbody_links;
create trigger tr_mindbody_links_auto_resolve_activation
after insert or update of mindbody_client_id on public.mindbody_links
for each row
execute function public.trig_auto_resolve_activation_on_link();

-- 3. Trigger on profiles to auto-resolve activation requests when account_status becomes 'active'
create or replace function public.trig_auto_resolve_activation_on_profile_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_status = 'active' and (old.account_status is distinct from 'active') then
    update public.activation_requests
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now())
    where user_id = new.id
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_auto_resolve_activation on public.profiles;
create trigger tr_profiles_auto_resolve_activation
after update of account_status on public.profiles
for each row
execute function public.trig_auto_resolve_activation_on_profile_active();

-- 4. Update admin_list_activation_requests to ensure "pending" never shows already-active / linked members
create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
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
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_order not in ('newest', 'oldest', 'linked_first') then
    v_order := 'newest';
  end if;

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
  where (
      case
        when v_status = 'pending' then
          ar.status = 'pending'
          and coalesce(p.account_status, 'activation_required') != 'active'
          and ml.mindbody_client_id is null
        when v_status is not null then
          ar.status = v_status
        else true
      end
    )
    and u.email::text not ilike '%@privaterelay.appleid.com'
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    )
  order by
    case when v_status is null and ar.status = 'pending' then 0 else 1 end,
    case
      when v_order = 'linked_first' and ml.mindbody_client_id is not null then 0
      when v_order = 'linked_first' then 1
      else 0
    end,
    case when v_order = 'oldest' then ar.requested_at end asc,
    case when v_order in ('newest', 'linked_first') then ar.requested_at end desc,
    ar.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int, text, text) from public;
grant execute on function public.admin_list_activation_requests(text, int, int, text, text) to authenticated;

-- 5. Update admin_count_activation_requests to match the same logic
create or replace function public.admin_count_activation_requests(
  p_status text default null,
  p_query text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(p_status), '');
  v_query text := nullif(trim(p_query), '');
  v_count int;
begin
  perform public.require_admin();

  select count(*)::int
  into v_count
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where (
      case
        when v_status = 'pending' then
          ar.status = 'pending'
          and coalesce(p.account_status, 'activation_required') != 'active'
          and ml.mindbody_client_id is null
        when v_status is not null then
          ar.status = v_status
        else true
      end
    )
    and u.email::text not ilike '%@privaterelay.appleid.com'
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_count_activation_requests(text, text) from public;
grant execute on function public.admin_count_activation_requests(text, text) to authenticated;
