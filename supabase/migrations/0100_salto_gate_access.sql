-- SALTO NexusOne gate access: device registry, audit logging, and async job dedupe.

create table if not exists public.gate_devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  label text,
  location_id text,
  enabled boolean not null default true,
  notes text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gate_devices is
  'Known SALTO/NexusOne devices allowed to validate member QR access.';

create index if not exists gate_devices_enabled_idx
  on public.gate_devices (enabled, device_id);

create table if not exists public.gate_access_attempts (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid references auth.users(id) on delete set null,
  mindbody_client_id text,
  device_id text not null,
  type text not null,
  request_type text,
  source text not null default 'salto_nexusone',
  granted boolean not null,
  message text not null,
  reason_code text not null,
  membership_status text,
  membership_last_synced_at timestamptz,
  token_jti uuid,
  token_expires_at timestamptz,
  check_in_id uuid references public.check_ins(id) on delete set null,
  arrival_job_id uuid references public.sync_jobs(id) on delete set null,
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.gate_access_attempts is
  'Every SALTO/NexusOne gate access decision, including denied and duplicate scans.';

create index if not exists gate_access_attempts_requested_idx
  on public.gate_access_attempts (requested_at desc);

create index if not exists gate_access_attempts_device_requested_idx
  on public.gate_access_attempts (device_id, requested_at desc);

create index if not exists gate_access_attempts_member_requested_idx
  on public.gate_access_attempts (member_user_id, requested_at desc)
  where member_user_id is not null;

create index if not exists gate_access_attempts_denied_requested_idx
  on public.gate_access_attempts (requested_at desc)
  where granted = false;

create index if not exists gate_access_attempts_token_requested_idx
  on public.gate_access_attempts (token_jti, requested_at desc)
  where token_jti is not null;

create unique index if not exists idx_sync_jobs_gate_arrival_active_checkin
  on public.sync_jobs ((payload->>'checkInId'))
  where job_type = 'mindbody_arrival'
    and status in ('pending', 'running')
    and payload ? 'checkInId';

create unique index if not exists idx_sync_jobs_membership_refresh_active_user
  on public.sync_jobs ((payload->>'targetUserId'))
  where job_type = 'mindbody_membership_refresh'
    and status in ('pending', 'running')
    and payload ? 'targetUserId';

alter table public.gate_devices enable row level security;
alter table public.gate_access_attempts enable row level security;

drop policy if exists "gate_devices admin read" on public.gate_devices;
create policy "gate_devices admin read"
  on public.gate_devices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  );

drop policy if exists "gate_devices admin write" on public.gate_devices;
create policy "gate_devices admin write"
  on public.gate_devices
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  );

drop policy if exists "gate_access_attempts admin read" on public.gate_access_attempts;
create policy "gate_access_attempts admin read"
  on public.gate_access_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  );

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
    'pendingActivations', (
      select count(*)::int
      from public.profiles
      where account_status = 'activation_required'
    ),
    'pendingActivationRequests', (
      select count(*)::int
      from public.activation_requests
      where status = 'pending'
    ),
    'profilesWithoutMindbodyLink', (
      select count(*)::int
      from public.profiles p
      where p.role in ('member', 'guest')
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
      select max(r.finished_at)
      from public.sync_job_runs r
      join public.sync_jobs j on j.id = r.job_id
      where j.job_type in ('visits', 'mindbody_visits')
        and r.status = 'completed'
    ),
    'pendingGateArrivalJobs', (
      select count(*)::int
      from public.sync_jobs
      where job_type = 'mindbody_arrival'
        and status in ('pending', 'running')
    ),
    'failedGateArrivalJobs24h', (
      select count(*)::int
      from public.sync_jobs
      where job_type = 'mindbody_arrival'
        and status = 'failed'
        and updated_at >= now() - interval '24 hours'
    ),
    'recentDeniedGateAttempts24h', (
      select count(*)::int
      from public.gate_access_attempts
      where granted = false
        and responded_at >= now() - interval '24 hours'
    ),
    'lastGateAttemptAt', (
      select max(responded_at)
      from public.gate_access_attempts
    ),
    'recentFailedSyncJobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'jobType', j.job_type,
            'errorMessage', j.error_message,
            'updatedAt', j.updated_at
          )
          order by j.updated_at desc
        )
        from (
          select id, job_type, error_message, updated_at
          from public.sync_jobs
          where status = 'failed'
          order by updated_at desc
          limit 5
        ) j
      ),
      '[]'::jsonb
    ),
    'recentFailedWebhooks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'eventType', e.event_type,
            'receivedAt', e.received_at
          )
          order by e.received_at desc
        )
        from (
          select id, event_type, received_at
          from public.mindbody_webhook_events
          where status = 'failed'
          order by received_at desc
          limit 5
        ) e
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
