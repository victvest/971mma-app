-- Rewards CMS: retail price, image URL, app settings (show prices / referral bonus),
-- create/soft-delete RPCs, and storage for reward images.

-- ── Schema ───────────────────────────────────────────────────────────────────

alter table public.rewards_catalog
  add column if not exists image_url text,
  add column if not exists price_aed numeric(10, 2) not null default 99
    check (price_aed >= 0);

update public.rewards_catalog
set price_aed = 99
where price_aed is null;

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  show_reward_prices boolean not null default true,
  referral_bonus_points int not null default 250 check (referral_bonus_points > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (id, show_reward_prices, referral_bonus_points)
values (1, true, 250)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings select authenticated" on public.app_settings;
create policy "app_settings select authenticated"
  on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists "app_settings update admin" on public.app_settings;
create policy "app_settings update admin"
  on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Storage: reward images ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reward-images',
  'reward-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Reward images are publicly readable" on storage.objects;
create policy "Reward images are publicly readable"
on storage.objects for select
using (bucket_id = 'reward-images');

drop policy if exists "Admins can upload reward images" on storage.objects;
create policy "Admins can upload reward images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'reward-images'
  and public.is_admin()
);

drop policy if exists "Admins can update reward images" on storage.objects;
create policy "Admins can update reward images"
on storage.objects for update to authenticated
using (
  bucket_id = 'reward-images'
  and public.is_admin()
)
with check (
  bucket_id = 'reward-images'
  and public.is_admin()
);

drop policy if exists "Admins can delete reward images" on storage.objects;
create policy "Admins can delete reward images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'reward-images'
  and public.is_admin()
);

-- ── App settings helpers ─────────────────────────────────────────────────────

create or replace function public.get_referral_bonus_points()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select referral_bonus_points from public.app_settings where id = 1),
    250
  );
$$;

create or replace function public.get_app_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'showRewardPrices', coalesce(s.show_reward_prices, true),
    'referralBonusPoints', coalesce(s.referral_bonus_points, 250)
  )
  from (select 1) _
  left join public.app_settings s on s.id = 1;
$$;

create or replace function public.admin_update_app_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings%rowtype;
begin
  perform public.require_admin();

  if p_payload is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.app_settings (id, show_reward_prices, referral_bonus_points, updated_at, updated_by)
  values (1, true, 250, now(), auth.uid())
  on conflict (id) do nothing;

  update public.app_settings
  set show_reward_prices = coalesce(
        (p_payload ->> 'show_reward_prices')::boolean,
        show_reward_prices
      ),
      referral_bonus_points = coalesce(
        (p_payload ->> 'referral_bonus_points')::int,
        referral_bonus_points
      ),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1
  returning * into v_row;

  if v_row.referral_bonus_points is null or v_row.referral_bonus_points <= 0 then
    raise exception using message = 'INVALID_REFERRAL_BONUS', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'showRewardPrices', v_row.show_reward_prices,
    'referralBonusPoints', v_row.referral_bonus_points,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.get_referral_bonus_points() from public, anon;
grant execute on function public.get_referral_bonus_points() to authenticated;

revoke all on function public.get_app_settings() from public, anon;
grant execute on function public.get_app_settings() to authenticated;

revoke all on function public.admin_update_app_settings(jsonb) from public, anon;
grant execute on function public.admin_update_app_settings(jsonb) to authenticated;

-- ── Referral bonus reads from settings ───────────────────────────────────────

create or replace function public.notify_member_referral_awarded(
  p_user uuid,
  p_referral_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_points int;
begin
  if p_user is null or p_referral_id is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user, 'referral'), true) then
    return;
  end if;

  v_points := public.get_referral_bonus_points();
  v_key := 'member_referral:' || p_role || ':' || p_user::text || ':' || p_referral_id::text;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user
      and n.type = 'reward'
      and n.payload->>'idempotencyKey' = v_key
  ) then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user,
    'reward',
    jsonb_build_object(
      'title', case when p_role = 'referrer' then 'Referral bonus earned' else 'Welcome bonus earned' end,
      'body', '+' || v_points::text || ' points',
      'referralId', p_referral_id,
      'pointsAward', v_points,
      'url', '/(tabs)/rewards',
      'idempotencyKey', v_key
    )
  );
end;
$$;

create or replace function public.complete_pending_referral(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_bonus int;
begin
  if p_user is null then
    return;
  end if;

  select *
    into v_referral
  from public.referrals
  where referred_user_id = p_user
    and status = 'pending'
  order by created_at asc
  limit 1
  for update;

  if not found then
    return;
  end if;

  v_bonus := public.get_referral_bonus_points();

  perform public.post_points_transaction(
    v_referral.referrer_user_id,
    v_bonus,
    'referral',
    'referrals',
    v_referral.id,
    'referral:referrer:' || v_referral.id::text,
    jsonb_build_object('role', 'referrer', 'referredUserId', v_referral.referred_user_id)
  );

  perform public.post_points_transaction(
    v_referral.referred_user_id,
    v_bonus,
    'referral',
    'referrals',
    v_referral.id,
    'referral:referred:' || v_referral.id::text,
    jsonb_build_object('role', 'referred', 'referrerUserId', v_referral.referrer_user_id)
  );

  update public.referrals
  set status = 'awarded',
      points_awarded_at = coalesce(points_awarded_at, now()),
      updated_at = now()
  where id = v_referral.id;

  perform public.notify_member_referral_awarded(v_referral.referrer_user_id, v_referral.id, 'referrer');
  perform public.notify_member_referral_awarded(v_referral.referred_user_id, v_referral.id, 'referred');
end;
$$;

-- ── Rewards create / soft-delete ─────────────────────────────────────────────

create or replace function public.admin_create_reward(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rewards_catalog%rowtype;
  v_name text;
  v_category text;
  v_cost int;
begin
  perform public.require_admin();

  if p_payload is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  v_name := nullif(trim(p_payload ->> 'name'), '');
  v_category := coalesce(nullif(trim(p_payload ->> 'category'), ''), 'gear');
  v_cost := coalesce((p_payload ->> 'cost_points')::int, 100);

  if v_name is null then
    raise exception using message = 'NAME_REQUIRED', errcode = 'P0001';
  end if;

  if v_category not in ('cafeteria', 'gear', 'coaching', 'events') then
    raise exception using message = 'INVALID_CATEGORY', errcode = 'P0001';
  end if;

  if v_cost is null or v_cost <= 0 then
    raise exception using message = 'INVALID_COST', errcode = 'P0001';
  end if;

  insert into public.rewards_catalog (
    name,
    description,
    category,
    cost_points,
    price_aed,
    image_url,
    active,
    unlock_rule,
    fulfillment,
    inventory,
    sort_order,
    max_per_user
  )
  values (
    v_name,
    nullif(trim(p_payload ->> 'description'), ''),
    v_category,
    v_cost,
    coalesce((p_payload ->> 'price_aed')::numeric, 99),
    nullif(trim(p_payload ->> 'image_url'), ''),
    coalesce((p_payload ->> 'active')::boolean, true),
    coalesce(p_payload -> 'unlock_rule', '{}'::jsonb),
    coalesce(nullif(trim(p_payload ->> 'fulfillment'), ''), 'manual'),
    case
      when p_payload ? 'inventory' and nullif(p_payload ->> 'inventory', '') is not null
        then (p_payload ->> 'inventory')::int
      else null
    end,
    coalesce((p_payload ->> 'sort_order')::int, 0),
    case
      when p_payload ? 'max_per_user' and nullif(p_payload ->> 'max_per_user', '') is not null
        then (p_payload ->> 'max_per_user')::int
      else null
    end
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_soft_delete_reward(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rewards_catalog%rowtype;
begin
  perform public.require_admin();

  if p_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  update public.rewards_catalog
  set active = false,
      deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_create_reward(jsonb) from public, anon;
grant execute on function public.admin_create_reward(jsonb) to authenticated;

revoke all on function public.admin_soft_delete_reward(uuid) from public, anon;
grant execute on function public.admin_soft_delete_reward(uuid) to authenticated;

-- ── Extend content update for reward CMS fields ──────────────────────────────

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
          description = coalesce(p_payload ->> 'description', description),
          unlock_days = coalesce((p_payload ->> 'unlock_days')::int, unlock_days),
          points_award = coalesce((p_payload ->> 'points_award')::int, points_award),
          category = coalesce(p_payload ->> 'category', category),
          icon = coalesce(p_payload ->> 'icon', icon),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(milestones.*) into v_row;

    when 'rewards_catalog' then
      update public.rewards_catalog
      set name = coalesce(nullif(trim(p_payload ->> 'name'), ''), name),
          description = case
            when p_payload ? 'description' then nullif(trim(p_payload ->> 'description'), '')
            else description
          end,
          category = coalesce(nullif(trim(p_payload ->> 'category'), ''), category),
          cost_points = coalesce((p_payload ->> 'cost_points')::int, cost_points),
          price_aed = coalesce((p_payload ->> 'price_aed')::numeric, price_aed),
          image_url = case
            when p_payload ? 'image_url' then nullif(trim(p_payload ->> 'image_url'), '')
            else image_url
          end,
          active = coalesce((p_payload ->> 'active')::boolean, active),
          unlock_rule = coalesce(p_payload -> 'unlock_rule', unlock_rule),
          fulfillment = coalesce(nullif(trim(p_payload ->> 'fulfillment'), ''), fulfillment),
          inventory = case
            when p_payload ? 'inventory' then
              case
                when nullif(p_payload ->> 'inventory', '') is null then null
                else (p_payload ->> 'inventory')::int
              end
            else inventory
          end,
          max_per_user = case
            when p_payload ? 'max_per_user' then
              case
                when nullif(p_payload ->> 'max_per_user', '') is null then null
                else (p_payload ->> 'max_per_user')::int
              end
            else max_per_user
          end,
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order),
          deleted_at = case
            when (p_payload ->> 'active')::boolean = true then null
            when p_payload ? 'deleted_at' then (p_payload ->> 'deleted_at')::timestamptz
            else deleted_at
          end,
          updated_at = now()
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

    when 'membership_product_disciplines' then
      update public.membership_product_disciplines
      set match_type = coalesce(p_payload ->> 'match_type', match_type),
          match_value = coalesce(nullif(trim(p_payload ->> 'match_value'), ''), match_value),
          discipline_id = coalesce(nullif(p_payload ->> 'discipline_id', '')::uuid, discipline_id),
          priority = coalesce((p_payload ->> 'priority')::int, priority),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          notes = case
            when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '')
            else notes
          end,
          updated_at = now()
      where id = p_id
      returning to_jsonb(membership_product_disciplines.*) into v_row;

    else
      raise exception using message = 'UNSUPPORTED_TABLE', errcode = 'P0001';
  end case;

  if v_row is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.admin_update_content_entry(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_update_content_entry(text, uuid, jsonb) to authenticated;
