-- Admin tooling for account deletion requests.

create or replace function public.admin_update_account_deletion_request(
  p_id uuid,
  p_status text,
  p_notes text default null
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.account_deletion_requests;
begin
  perform public.require_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'pending');
  if v_status not in ('pending', 'processing', 'completed', 'cancelled') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.account_deletion_requests
  set
    status = v_status,
    notes = coalesce(nullif(trim(p_notes), ''), notes),
    processed_at = case
      when v_status in ('completed', 'cancelled') then coalesce(processed_at, now())
      else processed_at
    end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_account_deletion_request',
    'account_deletion_requests',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_account_deletion_request(uuid, text, text) from public;
grant execute on function public.admin_update_account_deletion_request(uuid, text, text) to authenticated;

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
      where not exists (
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
    )
  )
  into v_result;

  return v_result;
end;
$$;
