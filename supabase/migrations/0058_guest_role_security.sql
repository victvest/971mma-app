-- Database support and security policies for the Premium Guest Role.

-- 1. Extend profiles.role check constraint to include 'guest'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'coach', 'admin', 'gate', 'guest'));

-- 2. Update admin_set_user_role function to support the 'guest' role.
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

  if p_role is null or p_role not in ('member', 'coach', 'admin', 'gate', 'guest') then
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

-- 3. Allow anonymous (non-logged in guest) users to read public reference tables.
drop policy if exists "classes read all phase1" on public.classes;
create policy "classes read all phase1" on public.classes
  for select to authenticated, anon using (true);

drop policy if exists "coaches select all" on public.coaches;
create policy "coaches select all" on public.coaches
  for select to authenticated, anon using (true);

drop policy if exists "programs select all" on public.programs;
create policy "programs select all" on public.programs
  for select to authenticated, anon using (true);

drop policy if exists "announcements select all" on public.announcements;
create policy "announcements select all" on public.announcements
  for select to authenticated, anon using (true);

drop policy if exists "rewards_catalog select all" on public.rewards_catalog;
create policy "rewards_catalog select all" on public.rewards_catalog
  for select to authenticated, anon using (true);
