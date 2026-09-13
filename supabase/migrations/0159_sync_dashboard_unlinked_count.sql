-- 0159_sync_dashboard_unlinked_count.sql
-- Synchronize unlinked member status and align dashboard counts with the activation queue.

-- 1. Align unlinked 'registered' profiles to 'activation_required'
update public.profiles
set account_status = 'activation_required'
where account_status = 'registered'
  and not exists (
    select 1 from public.mindbody_links ml
    where ml.user_id = profiles.id
      and nullif(trim(ml.mindbody_client_id), '') is not null
  );

-- 2. Update admin_system_health so pendingActivations reflects all unlinked profiles
create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_can_manage_bugs boolean;
begin
  perform public.require_admin();
  v_can_manage_bugs := public.is_bug_events_admin();

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
      from public.profiles p
      where coalesce(p.account_status, 'activation_required') != 'active'
        and not exists (
          select 1
          from public.mindbody_links ml
          where ml.user_id = p.id
            and nullif(trim(ml.mindbody_client_id), '') is not null
        )
    ),
    'pendingActivationRequests', (
      select count(*)::int
      from public.activation_requests ar
      join public.profiles p on p.id = ar.user_id
      left join public.mindbody_links ml on ml.user_id = ar.user_id
      where ar.status = 'pending'
        and coalesce(p.account_status, 'activation_required') != 'active'
        and ml.mindbody_client_id is null
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
    'newBugEvents', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where status = 'new'
      )
      else 0
    end,
    'openBugEvents', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where status in ('new', 'investigating')
      )
      else 0
    end,
    'fatalBugEvents24h', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where severity = 'fatal'
          and status in ('new', 'investigating')
          and created_at >= now() - interval '24 hours'
      )
      else 0
    end,
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
