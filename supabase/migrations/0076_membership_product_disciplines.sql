-- Admin-configurable Mindbody membership/contract product → discipline mappings.
-- Used by mb-membership sync instead of name heuristics when rules match.

create table if not exists public.membership_product_disciplines (
  id uuid primary key default gen_random_uuid(),
  match_type text not null check (match_type in ('mindbody_id', 'name_exact', 'name_contains')),
  match_value text not null,
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  priority int not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_product_disciplines_match_value_nonempty check (char_length(trim(match_value)) > 0)
);

create index if not exists membership_product_disciplines_active_priority_idx
  on public.membership_product_disciplines (active, priority, match_type);

create unique index if not exists membership_product_disciplines_unique_rule_idx
  on public.membership_product_disciplines (match_type, lower(trim(match_value)), discipline_id);

alter table public.membership_product_disciplines enable row level security;

drop policy if exists "membership_product_disciplines select admin" on public.membership_product_disciplines;
create policy "membership_product_disciplines select admin"
  on public.membership_product_disciplines
  for select to authenticated
  using (public.is_admin());

drop policy if exists "membership_product_disciplines insert admin" on public.membership_product_disciplines;
create policy "membership_product_disciplines insert admin"
  on public.membership_product_disciplines
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "membership_product_disciplines update admin" on public.membership_product_disciplines;
create policy "membership_product_disciplines update admin"
  on public.membership_product_disciplines
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "membership_product_disciplines delete admin" on public.membership_product_disciplines;
create policy "membership_product_disciplines delete admin"
  on public.membership_product_disciplines
  for delete to authenticated
  using (public.is_admin());

-- Extend audited content updater for mapping edits.
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

  perform public.write_admin_audit(
    'update_content_entry',
    p_table,
    p_id::text,
    p_payload
  );

  return v_row;
end;
$$;
