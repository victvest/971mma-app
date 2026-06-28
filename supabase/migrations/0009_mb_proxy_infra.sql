-- Phase 2: Mindbody proxy infrastructure.
-- These tables are service-role only: RLS is enabled and no authenticated policies are created.

create table if not exists public.mb_tokens (
  id int primary key default 1 check (id = 1),
  access_token text,
  token_type text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.mb_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mb_quota_log (
  day date primary key,
  call_count int not null default 0 check (call_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.mindbody_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'processed', 'failed'))
);

alter table public.mb_tokens enable row level security;
alter table public.mb_cache enable row level security;
alter table public.mb_quota_log enable row level security;
alter table public.mindbody_webhook_events enable row level security;

create index if not exists idx_mb_cache_expires_at
  on public.mb_cache (expires_at);
create index if not exists idx_mindbody_webhook_events_received
  on public.mindbody_webhook_events (received_at desc);

create or replace function public.mb_increment_quota(p_day date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v int;
begin
  insert into public.mb_quota_log(day, call_count)
  values (p_day, 1)
  on conflict (day) do update
    set call_count = public.mb_quota_log.call_count + 1,
        updated_at = now()
  returning call_count into v;

  return v;
end;
$$;

revoke execute on function public.mb_increment_quota(date) from public, anon, authenticated;
grant execute on function public.mb_increment_quota(date) to service_role;
