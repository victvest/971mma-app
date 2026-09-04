-- Unlimited Access (VIP Members)
-- Allows administrators to grant permanent/unlimited academy & app access
-- without requiring an active Mindbody membership or Mindbody link.

create table if not exists public.unlimited_access_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unlimited_access_members_user_id_key unique (user_id)
);

comment on table public.unlimited_access_members is
  'Members with unlimited access granted by admins. Gate reader and app bypass Mindbody membership requirement.';

create index if not exists idx_unlimited_access_user_id
  on public.unlimited_access_members (user_id);

create index if not exists idx_unlimited_access_active
  on public.unlimited_access_members (is_active)
  where is_active = true;

alter table public.unlimited_access_members enable row level security;

drop policy if exists "unlimited_access_members admin all" on public.unlimited_access_members;
create policy "unlimited_access_members admin all"
  on public.unlimited_access_members
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "unlimited_access_members select own" on public.unlimited_access_members;
create policy "unlimited_access_members select own"
  on public.unlimited_access_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Helper: Check if a user has active unlimited access
create or replace function public.is_unlimited_access_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unlimited_access_members
    where user_id = p_user_id
      and is_active = true
  );
$$;

revoke all on function public.is_unlimited_access_member(uuid) from public;
grant execute on function public.is_unlimited_access_member(uuid) to authenticated, anon, service_role;

-- Admin: List unlimited access members
create or replace function public.admin_list_unlimited_access_members(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  reason text,
  is_active boolean,
  granted_by uuid,
  granted_by_email text,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_by_email text,
  created_at timestamptz,
  updated_at timestamptz,
  mindbody_client_id text,
  membership_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := lower(nullif(trim(p_status), ''));
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_order not in ('newest', 'oldest', 'name') then
    v_order := 'newest';
  end if;

  return query
  select
    uam.id,
    uam.user_id,
    p.full_name,
    u.email::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), '')) as phone,
    p.avatar_url,
    uam.reason,
    uam.is_active,
    uam.granted_by,
    gb.email::text as granted_by_email,
    uam.revoked_at,
    uam.revoked_by,
    rb.email::text as revoked_by_email,
    uam.created_at,
    uam.updated_at,
    ml.mindbody_client_id,
    p.membership_status
  from public.unlimited_access_members uam
  join public.profiles p on p.id = uam.user_id
  join auth.users u on u.id = uam.user_id
  left join auth.users gb on gb.id = uam.granted_by
  left join auth.users rb on rb.id = uam.revoked_by
  left join public.mindbody_links ml on ml.user_id = uam.user_id
  where (
    v_status is null
    or v_status = 'all'
    or (v_status = 'active' and uam.is_active = true)
    or (v_status in ('inactive', 'revoked') and uam.is_active = false)
  )
  and (
    v_query is null
    or p.full_name ilike '%' || v_query || '%'
    or u.email::text ilike '%' || v_query || '%'
    or p.phone ilike '%' || v_query || '%'
    or u.phone ilike '%' || v_query || '%'
    or uam.reason ilike '%' || v_query || '%'
    or ml.mindbody_client_id ilike '%' || v_query || '%'
    or uam.user_id::text = v_query
  )
  order by
    case when v_order = 'name' then p.full_name end asc nulls last,
    case when v_order = 'oldest' then uam.created_at end asc,
    case when v_order = 'newest' then uam.created_at end desc,
    uam.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_unlimited_access_members(text, int, int, text, text) from public;
grant execute on function public.admin_list_unlimited_access_members(text, int, int, text, text) to authenticated;

-- Admin: Count unlimited access members
create or replace function public.admin_count_unlimited_access_members(
  p_status text default null,
  p_query text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(nullif(trim(p_status), ''));
  v_query text := nullif(trim(p_query), '');
  v_count int;
begin
  perform public.require_admin();

  select count(*)::int
  into v_count
  from public.unlimited_access_members uam
  join public.profiles p on p.id = uam.user_id
  join auth.users u on u.id = uam.user_id
  left join public.mindbody_links ml on ml.user_id = uam.user_id
  where (
    v_status is null
    or v_status = 'all'
    or (v_status = 'active' and uam.is_active = true)
    or (v_status in ('inactive', 'revoked') and uam.is_active = false)
  )
  and (
    v_query is null
    or p.full_name ilike '%' || v_query || '%'
    or u.email::text ilike '%' || v_query || '%'
    or p.phone ilike '%' || v_query || '%'
    or u.phone ilike '%' || v_query || '%'
    or uam.reason ilike '%' || v_query || '%'
    or ml.mindbody_client_id ilike '%' || v_query || '%'
    or uam.user_id::text = v_query
  );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_count_unlimited_access_members(text, text) from public;
grant execute on function public.admin_count_unlimited_access_members(text, text) to authenticated;

-- Admin: Grant unlimited access to a user
create or replace function public.admin_grant_unlimited_access(
  p_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_reason text := nullif(trim(p_reason), '');
  v_plan_name text := coalesce(v_reason, 'VIP Unlimited Access');
  v_now timestamptz := now();
  v_row public.unlimited_access_members;
begin
  perform public.require_admin();

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Member profile not found for id %', p_user_id;
  end if;

  insert into public.unlimited_access_members (
    user_id,
    reason,
    is_active,
    granted_by,
    revoked_at,
    revoked_by,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_reason,
    true,
    v_caller,
    null,
    null,
    v_now,
    v_now
  )
  on conflict (user_id) do update
  set
    reason = coalesce(excluded.reason, public.unlimited_access_members.reason),
    is_active = true,
    granted_by = v_caller,
    revoked_at = null,
    revoked_by = null,
    updated_at = v_now
  returning * into v_row;

  update public.profiles
  set
    membership_status = 'active',
    membership_name = v_plan_name,
    membership_source = 'unlimited',
    membership_last_synced_at = v_now
  where id = p_user_id;

  perform public.write_admin_audit(
    'grant_unlimited_access',
    'unlimited_access_members',
    p_user_id::text,
    jsonb_build_object(
      'reason', v_reason,
      'unlimited_id', v_row.id
    )
  );

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'userId', v_row.user_id,
    'isActive', v_row.is_active,
    'reason', v_row.reason,
    'grantedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.admin_grant_unlimited_access(uuid, text) from public;
grant execute on function public.admin_grant_unlimited_access(uuid, text) to authenticated;

-- Admin: Revoke unlimited access from a user
create or replace function public.admin_revoke_unlimited_access(
  p_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_now timestamptz := now();
  v_has_active_mb boolean := false;
  v_row public.unlimited_access_members;
begin
  perform public.require_admin();

  update public.unlimited_access_members
  set
    is_active = false,
    revoked_at = v_now,
    revoked_by = v_caller,
    updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  if not found then
    raise exception 'Unlimited access entry not found for user %', p_user_id;
  end if;

  -- Reconcile profile status with Mindbody mirrored memberships if available
  select exists (
    select 1
    from public.member_memberships
    where user_id = p_user_id
      and status = 'active'
  ) into v_has_active_mb;

  if not v_has_active_mb then
    update public.profiles
    set
      membership_status = case
        when exists (select 1 from public.member_memberships where user_id = p_user_id and status = 'paused') then 'paused'
        when exists (select 1 from public.member_memberships where user_id = p_user_id) then 'expired'
        else 'none'
      end,
      membership_source = case
        when exists (select 1 from public.member_memberships where user_id = p_user_id) then 'mindbody'
        else null
      end,
      membership_last_synced_at = v_now
    where id = p_user_id;
  end if;

  perform public.write_admin_audit(
    'revoke_unlimited_access',
    'unlimited_access_members',
    p_user_id::text,
    jsonb_build_object(
      'reason', nullif(trim(p_reason), ''),
      'unlimited_id', v_row.id
    )
  );

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'userId', v_row.user_id,
    'isActive', v_row.is_active,
    'revokedAt', v_row.revoked_at
  );
end;
$$;

revoke all on function public.admin_revoke_unlimited_access(uuid, text) from public;
grant execute on function public.admin_revoke_unlimited_access(uuid, text) to authenticated;
