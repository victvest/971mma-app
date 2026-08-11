-- App bug telemetry: authenticated app reports plus admin triage.

create table if not exists public.bug_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'error'
    check (severity in ('fatal', 'error', 'warning', 'info')),
  source text not null default 'manual'
    check (
      source in (
        'global_error',
        'unhandled_promise',
        'react_error_boundary',
        'console_error',
        'console_warn',
        'query_error',
        'mutation_error',
        'api_error',
        'manual'
      )
    ),
  status text not null default 'new'
    check (status in ('new', 'investigating', 'fixed', 'ignored')),
  title text not null,
  message text not null,
  stack text,
  route text,
  release text,
  app_version text,
  app_build text,
  runtime_version text,
  platform text,
  os_version text,
  device_name text,
  connection_type text,
  is_online boolean,
  breadcrumbs jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  fingerprint text,
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bug_events_status_created
  on public.bug_events (status, created_at desc);

create index if not exists idx_bug_events_user_created
  on public.bug_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_bug_events_severity_created
  on public.bug_events (severity, created_at desc);

create index if not exists idx_bug_events_source_created
  on public.bug_events (source, created_at desc);

create index if not exists idx_bug_events_new_created
  on public.bug_events (created_at desc)
  where status = 'new';

alter table public.bug_events enable row level security;

drop policy if exists "bug_events insert own" on public.bug_events;
create policy "bug_events insert own"
  on public.bug_events for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "bug_events select admin" on public.bug_events;
create policy "bug_events select admin"
  on public.bug_events for select
  to authenticated
  using (public.is_admin());

drop policy if exists "bug_events update admin" on public.bug_events;
create policy "bug_events update admin"
  on public.bug_events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.bug_events from anon;
grant insert, select, update on public.bug_events to authenticated;

create or replace function public.submit_bug_event(p_payload jsonb)
returns public.bug_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severity text;
  v_source text;
  v_title text;
  v_message text;
  v_breadcrumbs jsonb;
  v_context jsonb;
  v_row public.bug_events;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  v_severity := coalesce(nullif(trim(p_payload->>'severity'), ''), 'error');
  if v_severity not in ('fatal', 'error', 'warning', 'info') then
    v_severity := 'error';
  end if;

  v_source := coalesce(nullif(trim(p_payload->>'source'), ''), 'manual');
  if v_source not in (
    'global_error',
    'unhandled_promise',
    'react_error_boundary',
    'console_error',
    'console_warn',
    'query_error',
    'mutation_error',
    'api_error',
    'manual'
  ) then
    v_source := 'manual';
  end if;

  v_title := left(coalesce(nullif(trim(p_payload->>'title'), ''), 'App error'), 180);
  v_message := left(coalesce(nullif(trim(p_payload->>'message'), ''), v_title), 4000);

  v_breadcrumbs := coalesce(p_payload->'breadcrumbs', '[]'::jsonb);
  if jsonb_typeof(v_breadcrumbs) <> 'array' then
    v_breadcrumbs := '[]'::jsonb;
  end if;

  v_context := coalesce(p_payload->'context', '{}'::jsonb);
  if jsonb_typeof(v_context) <> 'object' then
    v_context := '{}'::jsonb;
  end if;

  insert into public.bug_events (
    user_id,
    severity,
    source,
    title,
    message,
    stack,
    route,
    release,
    app_version,
    app_build,
    runtime_version,
    platform,
    os_version,
    device_name,
    connection_type,
    is_online,
    breadcrumbs,
    context,
    fingerprint
  )
  values (
    auth.uid(),
    v_severity,
    v_source,
    v_title,
    v_message,
    nullif(left(coalesce(p_payload->>'stack', ''), 12000), ''),
    nullif(left(coalesce(p_payload->>'route', ''), 240), ''),
    nullif(left(coalesce(p_payload->>'release', ''), 120), ''),
    nullif(left(coalesce(p_payload->>'appVersion', ''), 80), ''),
    nullif(left(coalesce(p_payload->>'appBuild', ''), 80), ''),
    nullif(left(coalesce(p_payload->>'runtimeVersion', ''), 120), ''),
    nullif(left(coalesce(p_payload->>'platform', ''), 40), ''),
    nullif(left(coalesce(p_payload->>'osVersion', ''), 80), ''),
    nullif(left(coalesce(p_payload->>'deviceName', ''), 160), ''),
    nullif(left(coalesce(p_payload->>'connectionType', ''), 80), ''),
    case
      when p_payload ? 'isOnline' then (p_payload->>'isOnline')::boolean
      else null
    end,
    v_breadcrumbs,
    v_context,
    nullif(left(coalesce(p_payload->>'fingerprint', ''), 240), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_bug_event(jsonb) from public, anon;
grant execute on function public.submit_bug_event(jsonb) to authenticated;

drop function if exists public.admin_list_bug_events(text, text, text, text, int, int);
create or replace function public.admin_list_bug_events(
  p_status text default null,
  p_severity text default null,
  p_source text default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  user_full_name text,
  user_email text,
  severity text,
  source text,
  status text,
  title text,
  message text,
  stack text,
  route text,
  release text,
  app_version text,
  app_build text,
  runtime_version text,
  platform text,
  os_version text,
  device_name text,
  connection_type text,
  is_online boolean,
  breadcrumbs jsonb,
  context jsonb,
  fingerprint text,
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(p_status), '');
  v_severity text := nullif(trim(p_severity), '');
  v_source text := nullif(trim(p_source), '');
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();

  return query
  select
    be.id,
    be.user_id,
    p.full_name as user_full_name,
    u.email::text as user_email,
    be.severity,
    be.source,
    be.status,
    be.title,
    be.message,
    be.stack,
    be.route,
    be.release,
    be.app_version,
    be.app_build,
    be.runtime_version,
    be.platform,
    be.os_version,
    be.device_name,
    be.connection_type,
    be.is_online,
    be.breadcrumbs,
    be.context,
    be.fingerprint,
    be.admin_notes,
    be.resolved_at,
    be.resolved_by,
    be.created_at,
    be.updated_at
  from public.bug_events be
  left join public.profiles p on p.id = be.user_id
  left join auth.users u on u.id = be.user_id
  where (v_status is null or be.status = v_status)
    and (v_severity is null or be.severity = v_severity)
    and (v_source is null or be.source = v_source)
    and (
      v_query is null
      or be.id::text = v_query
      or be.user_id::text = v_query
      or be.title ilike '%' || v_query || '%'
      or be.message ilike '%' || v_query || '%'
      or coalesce(be.route, '') ilike '%' || v_query || '%'
      or coalesce(be.fingerprint, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email::text, '') ilike '%' || v_query || '%'
    )
  order by be.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_bug_events(text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_list_bug_events(text, text, text, text, int, int) to authenticated;

create or replace function public.admin_update_bug_event(
  p_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns public.bug_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.bug_events;
begin
  perform public.require_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'new');
  if v_status not in ('new', 'investigating', 'fixed', 'ignored') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.bug_events
  set
    status = v_status,
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = case
      when v_status in ('fixed', 'ignored') then coalesce(resolved_at, now())
      else null
    end,
    resolved_by = case
      when v_status in ('fixed', 'ignored') then auth.uid()
      else null
    end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_bug_event',
    'bug_events',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_bug_event(uuid, text, text) from public, anon;
grant execute on function public.admin_update_bug_event(uuid, text, text) to authenticated;

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
    'newBugEvents', (
      select count(*)::int
      from public.bug_events
      where status = 'new'
    ),
    'openBugEvents', (
      select count(*)::int
      from public.bug_events
      where status in ('new', 'investigating')
    ),
    'fatalBugEvents24h', (
      select count(*)::int
      from public.bug_events
      where severity = 'fatal'
        and status in ('new', 'investigating')
        and created_at >= now() - interval '24 hours'
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
