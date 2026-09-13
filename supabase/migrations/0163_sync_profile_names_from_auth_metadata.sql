-- 0163_sync_profile_names_from_auth_metadata.sql
-- Synchronize real member names from auth.users raw_user_meta_data into public.profiles.

-- 1. Backfill public.profiles with real names and phones from auth.users metadata
update public.profiles p
set full_name = trim(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), nullif(trim(u.raw_user_meta_data->>'name'), ''), p.full_name)),
    phone = coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), ''), nullif(trim(u.raw_user_meta_data->>'phone'), ''), nullif(trim(u.raw_user_meta_data->>'phone_number'), ''))
from auth.users u
where u.id = p.id
  and (
    p.full_name is null
    or p.full_name = 'Member'
    or trim(p.full_name) = ''
    or p.phone is null
  )
  and (
    u.raw_user_meta_data->>'full_name' is not null
    or u.raw_user_meta_data->>'name' is not null
    or u.phone is not null
    or u.raw_user_meta_data->>'phone' is not null
  );

-- 2. Update handle_new_user to populate full_name and phone and update on conflict
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  v_phone := nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number', '')), '');

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    v_name,
    v_phone,
    'member'
  )
  on conflict (id) do update
  set full_name = coalesce(nullif(trim(excluded.full_name), ''), profiles.full_name),
      phone = coalesce(nullif(trim(excluded.phone), ''), profiles.phone);

  return new;
end;
$$;

-- 3. Trigger on auth.users when raw_user_meta_data or phone updates
create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  v_phone := nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number', '')), '');

  if v_name is not null or v_phone is not null then
    update public.profiles
    set full_name = coalesce(v_name, profiles.full_name),
        phone = coalesce(v_phone, profiles.phone)
    where id = new.id
      and (
        (v_name is not null and (profiles.full_name is null or profiles.full_name = 'Member' or trim(profiles.full_name) = ''))
        or (v_phone is not null and profiles.phone is null)
      );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data, phone on auth.users
  for each row execute function public.handle_user_metadata_update();

-- 4. Update admin_list_activation_requests with robust name resolution
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
  mindbody_client_id text,
  requested_by_user boolean
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
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      'Member'
    ) as full_name,
    u.email::text,
    coalesce(
      nullif(trim(p.phone), ''),
      nullif(trim(u.phone), ''),
      nullif(trim(u.raw_user_meta_data->>'phone'), ''),
      nullif(trim(u.raw_user_meta_data->>'phone_number'), '')
    ) as phone,
    p.account_status,
    ml.mindbody_client_id,
    ar.requested_by_user
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where ar.requested_by_user = true
    and (
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
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or u.raw_user_meta_data->>'full_name' ilike '%' || v_query || '%'
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
