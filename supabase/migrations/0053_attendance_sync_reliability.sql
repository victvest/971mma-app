-- Migration: 0053_attendance_sync_reliability.sql
-- Add raw_payload to check_ins, create sync_jobs and sync_job_runs tables, and set up RLS.

-- 1. Add raw_payload column to check_ins
alter table public.check_ins
  add column if not exists raw_payload jsonb;

-- Mindbody visit imports are historical attendance records, distinct from QR/gate/coach entry.
-- Some early environments did not constrain method; keep this additive and future-safe.
do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  where c.conrelid = 'public.check_ins'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%method%'
  limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.check_ins drop constraint %I', v_constraint_name);
  end if;
end $$;

update public.check_ins
set method = case
  when method = 'qr' then 'qr_scan'
  when method = 'self' then 'qr_self'
  when method in ('manual', 'coach') then 'coach_roster'
  when method = 'mindbody_sync' then 'mindbody_visit'
  when method is null then 'qr_self'
  else method
end;

alter table public.check_ins
  add constraint check_ins_method_check
  check (method in ('qr_scan', 'qr_self', 'coach_roster', 'gate_scan', 'mindbody_visit'));

-- 2. Create sync_jobs table
create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_jobs_type_status_created
  on public.sync_jobs (job_type, status, created_at desc);

-- 3. Create sync_job_runs table
create table if not exists public.sync_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.sync_jobs(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_job_runs_job_started
  on public.sync_job_runs (job_id, started_at desc);

-- Existing environments may already have repeated coach-roster writes for the same class.
-- Keep the counted/earliest row so the uniqueness guard can be applied safely.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, class_id
      order by
        case when signed_in = true and missed = false and late_cancelled = false then 0 else 1 end,
        checked_in_at asc,
        ctid asc
    ) as rn
  from public.check_ins
  where class_id is not null
    and method = 'coach_roster'
)
delete from public.check_ins ci
using ranked r
where ci.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_check_ins_coach_roster_class_once
  on public.check_ins (user_id, class_id)
  where class_id is not null
    and method = 'coach_roster';

-- 4. Enable RLS
alter table public.sync_jobs enable row level security;
alter table public.sync_job_runs enable row level security;

-- 5. Policies
drop policy if exists "Admins can do anything on sync_jobs" on public.sync_jobs;
create policy "Admins can do anything on sync_jobs"
  on public.sync_jobs
  for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Admins can do anything on sync_job_runs" on public.sync_job_runs;
create policy "Admins can do anything on sync_job_runs"
  on public.sync_job_runs
  for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
    'pendingGuardianLinks', (
      select count(*)::int
      from public.guardian_links
      where status = 'pending'
    ),
    'pendingRedemptions', (
      select count(*)::int
      from public.redemptions
      where status = 'pending'
    ),
    'pendingAccountDeletions', (
      select count(*)::int
      from public.account_deletion_requests
      where status = 'pending'
    ),
    'profilesWithoutMindbodyLink', (
      select count(*)::int
      from public.profiles p
      where p.role = 'member'
        and not exists (
          select 1
          from public.mindbody_links ml
          where ml.user_id = p.id
        )
    ),
    'webhookEventsLast24h', (
      select count(*)::int
      from public.mindbody_webhook_events
      where received_at >= now() - interval '24 hours'
    ),
    'failedWebhookEventsLast24h', (
      select count(*)::int
      from public.mindbody_webhook_events
      where received_at >= now() - interval '24 hours'
        and status = 'failed'
    ),
    'lastWebhookReceivedAt', (
      select max(received_at)
      from public.mindbody_webhook_events
    ),
    'adminAuditEventsLast24h', (
      select count(*)::int
      from public.admin_audit_log
      where created_at >= now() - interval '24 hours'
    ),
    'syncJobsPending', (
      select count(*)::int
      from public.sync_jobs
      where status in ('pending', 'running')
    ),
    'syncJobsFailed24h', (
      select count(*)::int
      from public.sync_jobs
      where status = 'failed'
        and updated_at >= now() - interval '24 hours'
    ),
    'lastVisitSyncAt', (
      select max(finished_at)
      from public.sync_job_runs r
      join public.sync_jobs j on j.id = r.job_id
      where j.job_type in ('visits', 'mindbody_visits')
        and r.status = 'completed'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
