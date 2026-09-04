-- Migration 0148: Populate member_memberships for unlimited access VIP members
-- This ensures un-updated / existing production mobile app builds on the App Store & Play Store
-- read an active membership directly from member_memberships without requiring any client-side code changes.

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
  v_expires_at timestamptz := '2099-12-31 23:59:59+00'::timestamptz;
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
    membership_expires_at = v_expires_at,
    membership_last_synced_at = v_now
  where id = p_user_id;

  -- Insert/upsert into member_memberships so legacy/existing app builds display Active card
  insert into public.member_memberships (
    user_id,
    record_kind,
    mindbody_record_id,
    name,
    status,
    start_date,
    end_date,
    auto_renew,
    source,
    last_synced_at
  )
  values (
    p_user_id,
    'membership',
    'vip-' || p_user_id::text,
    v_plan_name,
    'active',
    v_now,
    v_expires_at,
    true,
    'mindbody',
    v_now
  )
  on conflict (user_id, record_kind, mindbody_record_id) do update
  set
    name = excluded.name,
    status = 'active',
    end_date = v_expires_at,
    auto_renew = true,
    last_synced_at = v_now;

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

  -- Remove the mirrored VIP membership row
  delete from public.member_memberships
  where user_id = p_user_id
    and mindbody_record_id = 'vip-' || p_user_id::text;

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
      membership_name = (
        select name from public.member_memberships where user_id = p_user_id order by end_date desc nulls last limit 1
      ),
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

-- Backfill active unlimited members into member_memberships immediately
insert into public.member_memberships (
  user_id,
  record_kind,
  mindbody_record_id,
  name,
  status,
  start_date,
  end_date,
  auto_renew,
  source,
  last_synced_at
)
select
  uam.user_id,
  'membership',
  'vip-' || uam.user_id::text,
  coalesce(uam.reason, 'VIP Unlimited Access'),
  'active',
  uam.created_at,
  '2099-12-31 23:59:59+00'::timestamptz,
  true,
  'mindbody',
  now()
from public.unlimited_access_members uam
where uam.is_active = true
on conflict (user_id, record_kind, mindbody_record_id) do update
set
  name = excluded.name,
  status = 'active',
  end_date = '2099-12-31 23:59:59+00'::timestamptz,
  auto_renew = true,
  last_synced_at = now();
