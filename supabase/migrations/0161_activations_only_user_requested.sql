-- 0161_activations_only_user_requested.sql
-- In the Activation tab, only show members who actually tapped "Request activation" in the mobile app.

-- 1. Remove synthetic activation requests (profiles auto-enrolled without tapping the in-app button)
delete from public.activation_requests
where requested_by_user = false;

-- 2. Update trig_sync_activation_request_on_profile so it only resolves existing requests when active,
--    and never auto-inserts a new activation request if the member has not tapped the button in the app.
create or replace function public.trig_sync_activation_request_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_status = 'active' then
    update public.activation_requests
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now())
    where user_id = new.id
      and status = 'pending';
  elsif new.account_status = 'activation_required' then
    -- Only reopen if an activation request was already submitted by the user
    update public.activation_requests
    set status = 'pending',
        resolved_at = null
    where user_id = new.id
      and status != 'pending'
      and requested_by_user = true;
  end if;
  return new;
end;
$$;

-- 3. Update trig_auto_reopen_activation_on_unlink so unlinking only reopens existing user requests
create or replace function public.trig_auto_reopen_activation_on_unlink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activation_requests
  set status = 'pending',
      resolved_at = null
  where user_id = old.user_id
    and requested_by_user = true;
  return old;
end;
$$;

-- 4. Update admin_list_activation_requests to strictly filter for requested_by_user = true
create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  full_name text,
  email text,
  phone text,
  account_status text,
  mindbody_client_id text,
  requested_by_user boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(p_status), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_order not in ('newest', 'oldest', 'linked_first') then
    v_order := 'newest';
  end if;

  return query
  select
    ar.id,
    ar.user_id,
    ar.status,
    ar.requested_at,
    ar.resolved_at,
    p.full_name,
    u.email::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), '')) as phone,
    p.account_status,
    ml.mindbody_client_id,
    ar.requested_by_user
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where ar.requested_by_user = true
    and (
      case
        when v_status = 'pending' then
          ar.status = 'pending'
          and coalesce(p.account_status, 'activation_required') != 'active'
          and ml.mindbody_client_id is null
        when v_status is not null then
          ar.status = v_status
        else true
      end
    )
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    )
  order by
    case when v_status is null and ar.status = 'pending' then 0 else 1 end,
    case
      when v_order = 'linked_first' and ml.mindbody_client_id is not null then 0
      when v_order = 'linked_first' then 1
      else 0
    end,
    case when v_order = 'oldest' then ar.requested_at end asc,
    case when v_order in ('newest', 'linked_first') then ar.requested_at end desc,
    ar.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int, text, text) from public;
grant execute on function public.admin_list_activation_requests(text, int, int, text, text) to authenticated;

-- 5. Update admin_system_health pendingActivationRequests to count only user-requested activations
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
        and ar.requested_by_user = true
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
