-- Phase 9: Admin web V1 — health extensions, broadcasts, reports, audited coach disciplines.

-- ── admin_system_health extensions ────────────────────────────────────────────

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
            'id', w.id,
            'eventType', w.event_type,
            'receivedAt', w.received_at
          )
          order by w.received_at desc
        )
        from (
          select id, event_type, received_at
          from public.mindbody_webhook_events
          where status = 'failed'
          order by received_at desc
          limit 5
        ) w
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ── admin_update_coach_disciplines ────────────────────────────────────────────

create or replace function public.admin_update_coach_disciplines(
  p_coach_id uuid,
  p_discipline_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_discipline_ids, '{}'::uuid[]);
begin
  perform public.require_admin();

  if p_coach_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if not exists (select 1 from public.coaches where id = p_coach_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  delete from public.coach_disciplines
  where coach_id = p_coach_id;

  if array_length(v_ids, 1) is not null then
    insert into public.coach_disciplines (coach_id, discipline_id)
    select p_coach_id, d.id
    from unnest(v_ids) as input(id)
    join public.disciplines d on d.id = input.id
    on conflict (coach_id, discipline_id) do nothing;
  end if;

  perform public.write_admin_audit(
    'update_coach_disciplines',
    'coach_disciplines',
    p_coach_id::text,
    jsonb_build_object('disciplineIds', to_jsonb(v_ids))
  );

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', d.id, 'slug', d.slug, 'displayName', d.display_name)
        order by d.sort_order asc
      )
      from public.coach_disciplines cd
      join public.disciplines d on d.id = cd.discipline_id
      where cd.coach_id = p_coach_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.admin_update_coach_disciplines(uuid, uuid[]) from public, anon;
grant execute on function public.admin_update_coach_disciplines(uuid, uuid[]) to authenticated;

-- ── admin_send_broadcast ──────────────────────────────────────────────────────

create or replace function public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_audience text default 'members',
  p_channel text default 'broadcast'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_audience text := lower(coalesce(nullif(trim(p_audience), ''), 'members'));
  v_channel text := nullif(trim(p_channel), '');
  v_row public.announcements%rowtype;
  v_recipients integer := 0;
begin
  perform public.require_admin();

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_audience not in ('all', 'members', 'coaches', 'active_members') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'broadcast'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body,
      'audience', v_audience
    )
  from public.profiles p
  where coalesce(public.notification_enabled(p.id, 'announcement'), true)
    and (
      v_audience = 'all'
      or (v_audience = 'members' and p.role in ('member', 'guest'))
      or (v_audience = 'coaches' and p.role = 'coach')
      or (
        v_audience = 'active_members'
        and p.account_status = 'active'
        and p.role in ('member', 'guest')
      )
    );

  get diagnostics v_recipients = row_count;

  perform public.write_admin_audit(
    'send_broadcast',
    'announcements',
    v_row.id::text,
    jsonb_build_object(
      'audience', v_audience,
      'channel', v_row.channel,
      'recipientCount', v_recipients
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'channel', v_row.channel,
    'audience', v_audience,
    'recipientCount', v_recipients,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke execute on function public.admin_send_broadcast(text, text, text, text) from public, anon;
grant execute on function public.admin_send_broadcast(text, text, text, text) to authenticated;

-- ── admin_reports_summary ─────────────────────────────────────────────────────

create or replace function public.admin_reports_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - interval '30 days';
  v_prev_since timestamptz := now() - interval '60 days';
begin
  perform public.require_admin();

  return jsonb_build_object(
    'windowDays', 30,
    'attendanceCount', (
      select count(*)::int
      from public.check_ins ci
      where ci.checked_in_at >= v_since
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
    ),
    'uniqueAttendees', (
      select count(distinct ci.user_id)::int
      from public.check_ins ci
      where ci.checked_in_at >= v_since
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
    ),
    'pointsIssued', (
      select coalesce(sum(pl.delta), 0)::int
      from public.points_ledger pl
      where pl.created_at >= v_since
        and pl.delta > 0
    ),
    'redemptionsCount', (
      select count(*)::int
      from public.redemptions r
      where r.created_at >= v_since
    ),
    'fulfilledRedemptions', (
      select count(*)::int
      from public.redemptions r
      where r.created_at >= v_since
        and r.status = 'fulfilled'
    ),
    'activeMembers', (
      select count(*)::int
      from public.profiles p
      where p.account_status = 'active'
        and p.role in ('member', 'guest')
    ),
    'retentionRate', (
      select case
        when prev.count = 0 then null
        else round((curr.count::numeric / prev.count::numeric) * 100, 1)
      end
      from (
        select count(distinct user_id)::numeric as count
        from public.check_ins
        where checked_in_at >= v_since
          and signed_in = true
          and missed = false
          and late_cancelled = false
      ) curr,
      (
        select count(distinct user_id)::numeric as count
        from public.check_ins
        where checked_in_at >= v_prev_since
          and checked_in_at < v_since
          and signed_in = true
          and missed = false
          and late_cancelled = false
      ) prev
    ),
    'topClasses', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'classId', t.class_id,
            'title', t.title,
            'discipline', t.discipline,
            'attendanceCount', t.cnt
          )
          order by t.cnt desc
        )
        from (
          select
            c.id as class_id,
            c.title,
            coalesce(d.display_name, c.discipline) as discipline,
            count(*)::int as cnt
          from public.check_ins ci
          join public.classes c on c.id = ci.class_id
          left join public.disciplines d on d.id = c.discipline_id
          where ci.checked_in_at >= v_since
            and ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
            and ci.class_id is not null
          group by c.id, c.title, coalesce(d.display_name, c.discipline)
          order by cnt desc
          limit 8
        ) t
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.admin_reports_summary() from public, anon;
grant execute on function public.admin_reports_summary() to authenticated;

-- ── admin_create_sync_retry_job ───────────────────────────────────────────────

create or replace function public.admin_create_sync_retry_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.sync_jobs%rowtype;
  v_job public.sync_jobs%rowtype;
begin
  perform public.require_admin();

  select * into v_source
  from public.sync_jobs
  where id = p_job_id;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.sync_jobs (job_type, status, payload)
  values (
    v_source.job_type,
    'pending',
    coalesce(v_source.payload, '{}'::jsonb) || jsonb_build_object('retryOf', v_source.id)
  )
  returning * into v_job;

  perform public.write_admin_audit(
    'create_sync_retry_job',
    'sync_jobs',
    v_job.id::text,
    jsonb_build_object('retryOf', v_source.id, 'jobType', v_source.job_type)
  );

  return jsonb_build_object(
    'id', v_job.id,
    'jobType', v_job.job_type,
    'status', v_job.status,
    'createdAt', v_job.created_at
  );
end;
$$;

revoke execute on function public.admin_create_sync_retry_job(uuid) from public, anon;
grant execute on function public.admin_create_sync_retry_job(uuid) to authenticated;

-- ── programs mapping in admin_update_content_entry ────────────────────────────

create or replace function public.admin_update_content_entry(
  p_table text,
  p_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  perform public.require_admin();

  if p_id is null or p_table is null or p_payload is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  case p_table
    when 'lineage_entries' then
      update public.lineage_entries
      set year_label = coalesce(p_payload ->> 'year_label', year_label),
          name = coalesce(p_payload ->> 'name', name),
          role = coalesce(p_payload ->> 'role', role),
          note = coalesce(p_payload ->> 'note', note),
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(lineage_entries.*) into v_row;

    when 'milestones' then
      update public.milestones
      set name = coalesce(p_payload ->> 'name', name),
          unlock_days = coalesce((p_payload ->> 'unlock_days')::int, unlock_days),
          category = coalesce(p_payload ->> 'category', category),
          icon = coalesce(p_payload ->> 'icon', icon),
          active = coalesce((p_payload ->> 'active')::boolean, active)
      where id = p_id
      returning to_jsonb(milestones.*) into v_row;

    when 'rewards_catalog' then
      update public.rewards_catalog
      set name = coalesce(p_payload ->> 'name', name),
          category = coalesce(p_payload ->> 'category', category),
          cost_points = coalesce((p_payload ->> 'cost_points')::int, cost_points),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          unlock_rule = coalesce(p_payload -> 'unlock_rule', unlock_rule),
          fulfillment = coalesce(p_payload ->> 'fulfillment', fulfillment),
          inventory = case
            when p_payload ? 'inventory' then (p_payload ->> 'inventory')::int
            else inventory
          end,
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(rewards_catalog.*) into v_row;

    when 'belt_ranks' then
      update public.belt_ranks
      set discipline = coalesce(p_payload ->> 'discipline', discipline),
          name = coalesce(p_payload ->> 'name', name),
          "order" = coalesce((p_payload ->> 'order')::int, "order"),
          stripes = coalesce((p_payload ->> 'stripes')::int, stripes)
      where id = p_id
      returning to_jsonb(belt_ranks.*) into v_row;

    when 'belt_requirements' then
      update public.belt_requirements
      set stripe = coalesce((p_payload ->> 'stripe')::int, stripe),
          title = coalesce(p_payload ->> 'title', title),
          description = coalesce(p_payload ->> 'description', description),
          type = coalesce(p_payload ->> 'type', type),
          attendance_target = case
            when p_payload ? 'attendance_target' then (p_payload ->> 'attendance_target')::int
            else attendance_target
          end,
          unlock_after_stripe = case
            when p_payload ? 'unlock_after_stripe' then (p_payload ->> 'unlock_after_stripe')::int
            else unlock_after_stripe
          end
      where id = p_id
      returning to_jsonb(belt_requirements.*) into v_row;

    when 'announcements' then
      update public.announcements
      set channel = coalesce(p_payload ->> 'channel', channel),
          title = coalesce(p_payload ->> 'title', title),
          body = coalesce(p_payload ->> 'body', body)
      where id = p_id
      returning to_jsonb(announcements.*) into v_row;

    when 'programs' then
      update public.programs
      set discipline_id = case
            when p_payload ? 'discipline_id' then nullif(p_payload ->> 'discipline_id', '')::uuid
            else discipline_id
          end,
          active = coalesce((p_payload ->> 'active')::boolean, active)
      where id = p_id
      returning to_jsonb(programs.*) into v_row;

    else
      raise exception using message = 'UNSUPPORTED_TABLE', errcode = 'P0001';
  end case;

  if v_row is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_content_entry',
    p_table,
    p_id::text,
    p_payload
  );

  return v_row;
end;
$$;
