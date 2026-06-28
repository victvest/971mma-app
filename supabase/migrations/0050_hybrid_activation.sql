-- Migration: 0050_hybrid_activation.sql
-- Add account_status to profiles, create mindbody_link_attempts, and update admin_search_users RPC.

-- 1. Add account_status column to profiles
alter table public.profiles
  add column if not exists account_status text not null default 'registered'
    check (account_status in ('registered', 'activation_required', 'active', 'disabled', 'deleted'));

-- 2. Backfill existing profiles
update public.profiles p
set account_status = case
  when p.role in ('coach', 'admin', 'gate') then 'active'
  when exists (select 1 from public.mindbody_links l where l.user_id = p.id) then 'active'
  else 'registered'
end;

-- 3. Create mindbody_link_attempts table
create table if not exists public.mindbody_link_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  verified_email text,
  verified_phone text,
  match_basis text not null check (match_basis in ('email', 'phone', 'manual_fallback')),
  match_count int not null check (match_count >= 0),
  status text not null check (status in ('linked', 'activation_required', 'ambiguous', 'failed')),
  matched_mindbody_client_id text,
  raw_matches jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for performance
create index if not exists idx_mindbody_link_attempts_user_id
  on public.mindbody_link_attempts (user_id);

-- 4. Enable Row Level Security (RLS)
alter table public.mindbody_link_attempts enable row level security;

-- Policies for mindbody_link_attempts
create policy "users select own link attempts"
  on public.mindbody_link_attempts
  for select
  using (auth.uid() = user_id);

create policy "admins select all link attempts"
  on public.mindbody_link_attempts
  for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 5. Replace public.admin_search_users RPC
drop function if exists public.admin_search_users(text, int, int);
drop function if exists public.admin_search_users(text, int, int, text);

create or replace function public.admin_search_users(
  p_query text,
  p_limit int default 20,
  p_offset int default 0,
  p_status_filter text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  mindbody_client_id text,
  points_balance int,
  attendance_count bigint,
  membership_status text,
  created_at timestamptz,
  account_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(p_status_filter), '');
begin
  perform public.require_admin();

  if v_query is null then
    return query
    select
      p.id,
      coalesce(p.full_name, 'Member') as full_name,
      u.email::text,
      p.role,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0) as points_balance,
      (
        select count(*)::bigint
        from public.check_ins ci
        where ci.user_id = p.id
      ) as attendance_count,
      p.membership_status,
      p.created_at,
      p.account_status
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    where (v_status is null or p.account_status = v_status)
    order by p.created_at desc
    limit v_limit
    offset v_offset;
  else
    return query
    select
      p.id,
      coalesce(p.full_name, 'Member') as full_name,
      u.email::text,
      p.role,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0) as points_balance,
      (
        select count(*)::bigint
        from public.check_ins ci
        where ci.user_id = p.id
      ) as attendance_count,
      p.membership_status,
      p.created_at,
      p.account_status
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    where (p.full_name ilike '%' || v_query || '%'
       or u.email ilike '%' || v_query || '%'
       or ml.mindbody_client_id ilike '%' || v_query || '%')
      and (v_status is null or p.account_status = v_status)
    order by p.full_name
    limit v_limit
    offset v_offset;
  end if;
end;
$$;

grant execute on function public.admin_search_users(text, int, int, text) to authenticated;
