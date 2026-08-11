-- Retire leftover tablet-gate role after SALTO NexusOne became facility entry.
--
-- Migration 0112 dropped gate_tokens / exit PIN / is_gate_or_admin, but:
--   * profiles_role_check still allowed role = 'gate'
--   * any leftover gate accounts would still authenticate
-- Facility access is SALTO-only (member QR → salto-access-by-media). This migration
-- demotes residual gate users and closes the role permanently.
-- Does NOT change SALTO request/response contracts.

-- 1. Demote any remaining gate-role accounts to member.
update public.profiles
set role = 'member',
    updated_at = now()
where role = 'gate';

-- 2. Close the role at the DB constraint.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'coach', 'admin', 'guest'));

-- 3. Keep admin_set_user_role aligned (0112 already dropped 'gate'; reaffirm).
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_role text;
begin
  perform public.require_admin();

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_role is null or p_role not in ('member', 'coach', 'admin', 'guest') then
    raise exception using message = 'INVALID_ROLE', errcode = 'P0001';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception using message = 'CANNOT_DEMOTE_SELF', errcode = 'P0001';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_old_role := v_profile.role;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  perform public.write_admin_audit(
    'set_user_role',
    'profiles',
    p_user_id::text,
    jsonb_build_object('fromRole', v_old_role, 'toRole', p_role)
  );

  return v_profile;
end;
$$;
