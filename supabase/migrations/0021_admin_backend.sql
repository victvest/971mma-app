-- Phase 12 (production plan): Admin backend operations — audit log and audited RPCs.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_log_target
  on public.admin_audit_log (target_table, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log select admin" on public.admin_audit_log;
create policy "admin_audit_log select admin" on public.admin_audit_log
  for select to authenticated using (public.is_admin());

create or replace function public.require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.write_admin_audit(
  p_action text,
  p_target_table text,
  p_target_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    p_action,
    p_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.require_admin() from public;
revoke all on function public.write_admin_audit(text, text, text, jsonb) from public;
grant execute on function public.require_admin() to authenticated;

-- Members must not change their own role.
create or replace function public.protect_profile_membership_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  if auth.uid() = NEW.id then
    NEW.membership_tier := OLD.membership_tier;
    NEW.membership_status := OLD.membership_status;
    NEW.membership_expires_at := OLD.membership_expires_at;
    NEW.membership_name := OLD.membership_name;
    NEW.membership_source := OLD.membership_source;
    NEW.membership_last_synced_at := OLD.membership_last_synced_at;
    NEW.role := OLD.role;
  end if;

  return NEW;
end;
$$;

-- Admin read policies for operational screens (Phase 13).
drop policy if exists "profiles select admin" on public.profiles;
create policy "profiles select admin" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "redemptions select admin" on public.redemptions;
create policy "redemptions select admin" on public.redemptions
  for select to authenticated using (public.is_admin());

drop policy if exists "points_accounts select admin" on public.points_accounts;
create policy "points_accounts select admin" on public.points_accounts
  for select to authenticated using (public.is_admin());

drop policy if exists "points_ledger select admin" on public.points_ledger;
create policy "points_ledger select admin" on public.points_ledger
  for select to authenticated using (public.is_admin());

drop policy if exists "mindbody_links select admin" on public.mindbody_links;
create policy "mindbody_links select admin" on public.mindbody_links
  for select to authenticated using (public.is_admin());

drop policy if exists "check_ins select admin" on public.check_ins;
create policy "check_ins select admin" on public.check_ins
  for select to authenticated using (public.is_admin());

drop policy if exists "mindbody_webhook_events select admin" on public.mindbody_webhook_events;
create policy "mindbody_webhook_events select admin" on public.mindbody_webhook_events
  for select to authenticated using (public.is_admin());

create or replace function public._admin_restore_redemption_points(
  p_redemption public.redemptions
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.points_accounts%rowtype;
  v_new_balance int;
  v_reward public.rewards_catalog%rowtype;
begin
  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (p_redemption.user_id, 0, 'bronze', 0, now())
  on conflict (user_id) do nothing;

  select *
    into v_account
  from public.points_accounts
  where user_id = p_redemption.user_id
  for update;

  if exists (
    select 1
    from public.points_ledger
    where reason = 'adjustment'
      and ref_id = p_redemption.id
  ) then
    return v_account.balance;
  end if;

  v_new_balance := v_account.balance + p_redemption.cost_points;

  update public.points_accounts
  set balance = v_new_balance,
      updated_at = now()
  where user_id = p_redemption.user_id;

  insert into public.points_ledger (user_id, delta, reason, ref_id, balance_after)
  values (
    p_redemption.user_id,
    p_redemption.cost_points,
    'adjustment',
    p_redemption.id,
    v_new_balance
  );

  select *
    into v_reward
  from public.rewards_catalog
  where id = p_redemption.reward_id;

  if found and v_reward.inventory is not null then
    update public.rewards_catalog
    set inventory = inventory + 1
    where id = v_reward.id;
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public._admin_restore_redemption_points(public.redemptions) from public;

create or replace function public.admin_search_users(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
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
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();

  if v_query is null then
    return;
  end if;

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
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  left join public.points_accounts pa on pa.user_id = p.id
  where p.full_name ilike '%' || v_query || '%'
     or u.email ilike '%' || v_query || '%'
     or ml.mindbody_client_id ilike '%' || v_query || '%'
  order by p.full_name
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_role text;
begin
  perform public.require_admin();

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_role is null or p_role not in ('member', 'coach', 'admin') then
    raise exception using message = 'INVALID_ROLE', errcode = 'P0001';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception using message = 'CANNOT_DEMOTE_SELF', errcode = 'P0001';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_old_role := v_profile.role;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  perform public.write_admin_audit(
    'set_user_role',
    'profiles',
    p_user_id::text,
    jsonb_build_object('fromRole', v_old_role, 'toRole', p_role)
  );

  return v_profile;
end;
$$;

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_specialty text default null,
  p_rank text default null,
  p_rating numeric default null,
  p_bio text default null,
  p_photo_url text default null,
  p_is_head_coach boolean default null,
  p_sort_order int default null
)
returns public.coaches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_changes jsonb := '{}'::jsonb;
begin
  perform public.require_admin();

  if p_coach_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select *
    into v_coach
  from public.coaches
  where id = p_coach_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_rating is not null and (p_rating < 0 or p_rating > 5) then
    raise exception using message = 'INVALID_RATING', errcode = 'P0001';
  end if;

  update public.coaches
  set specialty = coalesce(p_specialty, specialty),
      rank = coalesce(p_rank, rank),
      rating = coalesce(p_rating, rating),
      bio = coalesce(p_bio, bio),
      photo_url = coalesce(p_photo_url, photo_url),
      is_head_coach = coalesce(p_is_head_coach, is_head_coach),
      sort_order = coalesce(p_sort_order, sort_order)
  where id = p_coach_id
  returning * into v_coach;

  v_changes := jsonb_strip_nulls(
    jsonb_build_object(
      'specialty', p_specialty,
      'rank', p_rank,
      'rating', p_rating,
      'bio', case when p_bio is not null then left(p_bio, 120) else null end,
      'photoUrl', p_photo_url,
      'isHeadCoach', p_is_head_coach,
      'sortOrder', p_sort_order
    )
  );

  perform public.write_admin_audit(
    'update_coach',
    'coaches',
    p_coach_id::text,
    v_changes
  );

  return v_coach;
end;
$$;

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

    else
      raise exception using message = 'UNSUPPORTED_TABLE', errcode = 'P0001';
  end case;

  if v_row is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_content',
    p_table,
    p_id::text,
    jsonb_build_object('fields', p_payload)
  );

  return v_row;
end;
$$;

create or replace function public.admin_fulfill_redemption(
  p_redemption_id uuid
)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
begin
  perform public.require_admin();

  select *
    into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_redemption.status <> 'pending' then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.redemptions
  set status = 'fulfilled',
      fulfilled_at = now()
  where id = p_redemption_id
  returning * into v_redemption;

  perform public.write_admin_audit(
    'fulfill_redemption',
    'redemptions',
    p_redemption_id::text,
    jsonb_build_object('userId', v_redemption.user_id, 'rewardId', v_redemption.reward_id)
  );

  return v_redemption;
end;
$$;

create or replace function public.admin_cancel_redemption(
  p_redemption_id uuid,
  p_reason text default null
)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.require_admin();

  select *
    into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_redemption.status <> 'pending' then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  perform public._admin_restore_redemption_points(v_redemption);

  update public.redemptions
  set status = 'cancelled',
      fulfilled_at = null
  where id = p_redemption_id
  returning * into v_redemption;

  perform public.write_admin_audit(
    'cancel_redemption',
    'redemptions',
    p_redemption_id::text,
    jsonb_build_object(
      'userId', v_redemption.user_id,
      'rewardId', v_redemption.reward_id,
      'reason', coalesce(v_reason, 'Cancelled by admin')
    )
  );

  return v_redemption;
end;
$$;

create or replace function public.admin_refund_redemption(
  p_redemption_id uuid,
  p_reason text default null
)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.require_admin();

  select *
    into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_redemption.status not in ('pending', 'fulfilled') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  perform public._admin_restore_redemption_points(v_redemption);

  update public.redemptions
  set status = 'refunded',
      fulfilled_at = case when v_redemption.status = 'fulfilled' then v_redemption.fulfilled_at else null end
  where id = p_redemption_id
  returning * into v_redemption;

  perform public.write_admin_audit(
    'refund_redemption',
    'redemptions',
    p_redemption_id::text,
    jsonb_build_object(
      'userId', v_redemption.user_id,
      'rewardId', v_redemption.reward_id,
      'reason', coalesce(v_reason, 'Refunded by admin')
    )
  );

  return v_redemption;
end;
$$;

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

revoke execute on function public.admin_search_users(text, int, int) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
revoke execute on function public.admin_update_coach(uuid, text, text, numeric, text, text, boolean, int) from public, anon;
revoke execute on function public.admin_update_content_entry(text, uuid, jsonb) from public, anon;
revoke execute on function public.admin_fulfill_redemption(uuid) from public, anon;
revoke execute on function public.admin_cancel_redemption(uuid, text) from public, anon;
revoke execute on function public.admin_refund_redemption(uuid, text) from public, anon;
revoke execute on function public.admin_system_health() from public, anon;

grant execute on function public.admin_search_users(text, int, int) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, numeric, text, text, boolean, int) to authenticated;
grant execute on function public.admin_update_content_entry(text, uuid, jsonb) to authenticated;
grant execute on function public.admin_fulfill_redemption(uuid) to authenticated;
grant execute on function public.admin_cancel_redemption(uuid, text) to authenticated;
grant execute on function public.admin_refund_redemption(uuid, text) to authenticated;
grant execute on function public.admin_system_health() to authenticated;
