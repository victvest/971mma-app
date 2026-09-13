-- 0164_super_admin_hard_delete_user.sql
-- Allow super admin to completely delete users from Supabase (auth.users + public.profiles + dependent rows).

-- 1. Loosen restrictive FK constraints that would block user deletion
alter table public.feed_moderation_actions
  alter column performed_by drop not null;

alter table public.feed_moderation_actions
  drop constraint if exists feed_moderation_actions_performed_by_fkey;

alter table public.feed_moderation_actions
  add constraint feed_moderation_actions_performed_by_fkey
  foreign key (performed_by) references public.profiles(id) on delete set null;

alter table public.roll_call_class_roster
  alter column added_by drop not null;

alter table public.roll_call_class_roster
  drop constraint if exists roll_call_class_roster_added_by_fkey;

alter table public.roll_call_class_roster
  add constraint roll_call_class_roster_added_by_fkey
  foreign key (added_by) references auth.users(id) on delete set null;

-- 2. Super admin helper functions
create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select lower(email)
  into v_email
  from auth.users
  where id = auth.uid();

  return v_email in (
    'bahaaeddinegueroumi@gmail.com',
    'youcefamineh@gmail.com'
  );
end;
$$;

create or replace function public.require_super_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  if not public.is_super_admin() then
    raise exception using message = 'SUPER_ADMIN_REQUIRED', errcode = 'P0001';
  end if;
end;
$$;

-- 3. Super admin hard delete RPC
create or replace function public.admin_hard_delete_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_email text;
  v_target_role text;
  v_remaining_admins int;
begin
  -- Guard: Only super admin can hard delete users
  perform public.require_super_admin();

  if p_target_user_id is null then
    raise exception using message = 'INVALID_USER_ID', errcode = 'P0001';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception using message = 'CANNOT_DELETE_SELF', errcode = 'P0001';
  end if;

  -- Verify target exists
  select email into v_target_email from auth.users where id = p_target_user_id;
  select role into v_target_role from public.profiles where id = p_target_user_id;

  if v_target_email is null and v_target_role is null then
    raise exception using message = 'USER_NOT_FOUND', errcode = 'P0001';
  end if;

  -- Guard: Do not delete last remaining admin
  if v_target_role = 'admin' then
    select count(*) into v_remaining_admins
    from public.profiles
    where role = 'admin' and id <> p_target_user_id;

    if v_remaining_admins < 1 then
      raise exception using message = 'CANNOT_DELETE_LAST_ADMIN', errcode = 'P0001';
    end if;
  end if;

  -- 1. Explicitly clear coach pointers
  update public.coaches
  set user_id = null
  where user_id = p_target_user_id;

  update public.coaches
  set suggested_user_id = null
  where suggested_user_id = p_target_user_id;

  -- 2. Clear moderation / sessions / attendance records where target was staff/coach
  update public.community_moderation_actions
  set performed_by = null
  where performed_by = p_target_user_id;

  update public.feed_moderation_actions
  set performed_by = null
  where performed_by = p_target_user_id;

  update public.roll_call_sessions
  set coach_id = null
  where coach_id = p_target_user_id;

  update public.roll_call_class_roster
  set added_by = null
  where added_by = p_target_user_id;

  update public.class_session_attendance
  set marked_by = null
  where marked_by = p_target_user_id;

  update public.unlimited_access_members
  set granted_by = null
  where granted_by = p_target_user_id;

  update public.unlimited_access_members
  set revoked_by = null
  where revoked_by = p_target_user_id;

  update public.announcements
  set author_id = null
  where author_id = p_target_user_id;

  update public.guardian_links
  set approved_by = null
  where approved_by = p_target_user_id;

  update public.bug_events
  set user_id = null
  where user_id = p_target_user_id;

  update public.bug_events
  set resolved_by = null
  where resolved_by = p_target_user_id;

  update public.gate_access_attempts
  set member_user_id = null
  where member_user_id = p_target_user_id;

  update public.app_settings
  set updated_by = null
  where updated_by = p_target_user_id;

  update public.admin_audit_log
  set actor_id = null
  where actor_id = p_target_user_id;

  update public.redemptions
  set fulfilled_by = null
  where fulfilled_by = p_target_user_id;

  update public.referrals
  set referred_user_id = null
  where referred_user_id = p_target_user_id;

  update public.check_ins
  set presented_by = null
  where presented_by = p_target_user_id;

  update public.qr_tokens
  set issued_by_user_id = null
  where issued_by_user_id = p_target_user_id;

  -- 3. Delete user requests and explicit links
  delete from public.account_deletion_requests
  where user_id = p_target_user_id;

  delete from public.activation_requests
  where user_id = p_target_user_id;

  delete from public.mindbody_links
  where user_id = p_target_user_id;

  delete from public.mindbody_link_attempts
  where user_id = p_target_user_id;

  delete from public.guardian_links
  where guardian_user_id = p_target_user_id or trainee_user_id = p_target_user_id;

  -- 4. Delete from public.profiles
  delete from public.profiles
  where id = p_target_user_id;

  -- 5. Delete from auth.users (cascades auth.identities, auth.sessions, etc.)
  delete from auth.users
  where id = p_target_user_id;

  -- 6. Log admin audit
  perform public.write_admin_audit(
    'super_admin_hard_delete_user',
    'auth.users',
    p_target_user_id::text,
    jsonb_build_object(
      'target_email', v_target_email,
      'target_role', v_target_role,
      'deleted_by', auth.uid()
    )
  );

  return jsonb_build_object(
    'success', true,
    'deleted_user_id', p_target_user_id,
    'deleted_email', v_target_email
  );
end;
$$;

revoke all on function public.admin_hard_delete_user(uuid) from public;
grant execute on function public.admin_hard_delete_user(uuid) to authenticated, service_role;
