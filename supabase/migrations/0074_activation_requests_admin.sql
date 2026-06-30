-- Admin tooling for member activation help requests.

create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  full_name text,
  email text,
  account_status text,
  mindbody_client_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(p_status), '');
begin
  perform public.require_admin();

  return query
  select
    ar.id,
    ar.user_id,
    ar.status,
    ar.requested_at,
    ar.resolved_at,
    p.full_name,
    u.email::text,
    p.account_status,
    ml.mindbody_client_id
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where v_status is null or ar.status = v_status
  order by
    case when ar.status = 'pending' then 0 else 1 end,
    ar.requested_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int) from public;
grant execute on function public.admin_list_activation_requests(text, int, int) to authenticated;

create or replace function public.admin_update_activation_request(
  p_id uuid,
  p_status text
)
returns public.activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.activation_requests;
begin
  perform public.require_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'pending');
  if v_status not in ('pending', 'resolved', 'cancelled') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.activation_requests
  set
    status = v_status,
    resolved_at = case
      when v_status = 'resolved' then coalesce(resolved_at, now())
      else resolved_at
    end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_activation_request',
    'activation_requests',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_activation_request(uuid, text) from public;
grant execute on function public.admin_update_activation_request(uuid, text) to authenticated;

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
