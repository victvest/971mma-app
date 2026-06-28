-- Phase 11: Mindbody membership/contracts mirror + profile summary columns.

alter table public.profiles
  add column if not exists membership_name text,
  add column if not exists membership_source text,
  add column if not exists membership_last_synced_at timestamptz;

create table if not exists public.member_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_kind text not null check (record_kind in ('membership', 'contract')),
  mindbody_record_id text not null,
  mindbody_contract_id text,
  mindbody_membership_id text,
  name text not null,
  status text not null default 'unknown',
  start_date timestamptz,
  end_date timestamptz,
  auto_renew boolean not null default false,
  source text not null default 'mindbody',
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, record_kind, mindbody_record_id)
);

create index if not exists member_memberships_user_id_idx
  on public.member_memberships (user_id);

alter table public.member_memberships enable row level security;

drop policy if exists "member_memberships select own" on public.member_memberships;
create policy "member_memberships select own" on public.member_memberships
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "member_memberships select admin" on public.member_memberships;
create policy "member_memberships select admin" on public.member_memberships
  for select to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create or replace function public.protect_profile_membership_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  if auth.uid() = NEW.id then
    NEW.membership_tier := OLD.membership_tier;
    NEW.membership_status := OLD.membership_status;
    NEW.membership_expires_at := OLD.membership_expires_at;
    NEW.membership_name := OLD.membership_name;
    NEW.membership_source := OLD.membership_source;
    NEW.membership_last_synced_at := OLD.membership_last_synced_at;
  end if;

  return NEW;
end;
$$;

drop trigger if exists protect_profile_membership_fields on public.profiles;
create trigger protect_profile_membership_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_membership_fields();
