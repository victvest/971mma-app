-- Phase 12: Parent/guardian links and managed trainee authorization.

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  trainee_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  child_display_name text not null,
  child_date_of_birth date,
  child_email text,
  child_phone text,
  mindbody_client_id text,
  request_notes text,
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_reason text,
  constraint guardian_links_trainee_unique unique (guardian_user_id, trainee_user_id)
);

create index if not exists idx_guardian_links_guardian_status
  on public.guardian_links (guardian_user_id, status);

create index if not exists idx_guardian_links_trainee_status
  on public.guardian_links (trainee_user_id, status)
  where trainee_user_id is not null;

create index if not exists idx_guardian_links_pending
  on public.guardian_links (status, requested_at desc)
  where status = 'pending';

alter table public.guardian_links enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_approved_guardian_of(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_links
    where guardian_user_id = auth.uid()
      and trainee_user_id = p_target
      and status = 'approved'
  );
$$;

create or replace function public.can_read_member_data(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_target
    or public.is_approved_guardian_of(p_target)
    or public.is_admin();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_approved_guardian_of(uuid) from public;
revoke all on function public.can_read_member_data(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_guardian_of(uuid) to authenticated;
grant execute on function public.can_read_member_data(uuid) to authenticated;

-- Guardian links: guardians manage their requests; admins review all.
drop policy if exists "guardian_links select own" on public.guardian_links;
create policy "guardian_links select own" on public.guardian_links
  for select to authenticated using (
    auth.uid() = guardian_user_id
    or public.is_admin()
  );

drop policy if exists "guardian_links insert own pending" on public.guardian_links;
create policy "guardian_links insert own pending" on public.guardian_links
  for insert to authenticated with check (
    auth.uid() = guardian_user_id
    and status = 'pending'
    and trainee_user_id is null
  );

drop policy if exists "guardian_links update admin" on public.guardian_links;
create policy "guardian_links update admin" on public.guardian_links
  for update to authenticated using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "guardian_links update revoke own" on public.guardian_links;
create policy "guardian_links update revoke own" on public.guardian_links
  for update to authenticated using (
    auth.uid() = guardian_user_id
    and status = 'approved'
  )
  with check (
    auth.uid() = guardian_user_id
    and status = 'revoked'
  );

-- Extend member-owned read policies for approved guardians.
drop policy if exists "check_ins select own phase1" on public.check_ins;
create policy "check_ins select own phase1" on public.check_ins
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "member_belt_progress select own" on public.member_belt_progress;
create policy "member_belt_progress select own" on public.member_belt_progress
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "member_requirement_status select own" on public.member_requirement_status;
create policy "member_requirement_status select own" on public.member_requirement_status
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "promotions select own" on public.promotions;
create policy "promotions select own" on public.promotions
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "points_accounts select own" on public.points_accounts;
create policy "points_accounts select own" on public.points_accounts
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "points_ledger select own" on public.points_ledger;
create policy "points_ledger select own" on public.points_ledger
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "member_milestones select own" on public.member_milestones;
create policy "member_milestones select own" on public.member_milestones
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "redemptions select own" on public.redemptions;
create policy "redemptions select own" on public.redemptions
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "discipline_scores select own" on public.discipline_scores;
create policy "discipline_scores select own" on public.discipline_scores
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "member_memberships select own" on public.member_memberships;
create policy "member_memberships select own" on public.member_memberships
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "mindbody_links select own" on public.mindbody_links;
create policy "mindbody_links select own" on public.mindbody_links
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "qr_tokens select own" on public.qr_tokens;
create policy "qr_tokens select own" on public.qr_tokens
  for select to authenticated using (public.can_read_member_data(user_id));

drop policy if exists "profiles select own or guardian" on public.profiles;
create policy "profiles select own or guardian" on public.profiles
  for select to authenticated using (public.can_read_member_data(id));

-- Parent requests a child link; child data stays hidden until admin approval.
create or replace function public.request_child_link(
  p_child_name text,
  p_date_of_birth date default null,
  p_email text default null,
  p_phone text default null,
  p_mindbody_client_id text default null,
  p_notes text default null
)
returns public.guardian_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_child_name), '');
  v_link public.guardian_links;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null then
    raise exception 'Child name is required';
  end if;

  insert into public.guardian_links (
    guardian_user_id,
    status,
    child_display_name,
    child_date_of_birth,
    child_email,
    child_phone,
    mindbody_client_id,
    request_notes
  )
  values (
    auth.uid(),
    'pending',
    v_name,
    p_date_of_birth,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_mindbody_client_id, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_link;

  return v_link;
end;
$$;

revoke all on function public.request_child_link(text, date, text, text, text, text) from public;
grant execute on function public.request_child_link(text, date, text, text, text, text) to authenticated;
