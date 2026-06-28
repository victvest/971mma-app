-- Phase 1 seed data.
-- Placeholder curriculum/reward values are intentionally marked as such pending client confirmation.

insert into public.belt_ranks (discipline, name, "order", stripes)
values
  ('bjj', 'White', 1, 4),
  ('bjj', 'Blue', 2, 4),
  ('bjj', 'Purple', 3, 4),
  ('bjj', 'Brown', 4, 4),
  ('bjj', 'Black', 5, 4)
on conflict (discipline, "order") do update
set name = excluded.name,
    stripes = excluded.stripes;

insert into public.belt_requirements
  (rank_id, stripe, title, description, type, attendance_target, unlock_after_stripe)
values
  (
    (select id from public.belt_ranks where discipline = 'bjj' and name = 'White'),
    1,
    '10 training days',
    'Placeholder attendance target for first-stripe readiness.',
    'attendance',
    10,
    0
  ),
  (
    (select id from public.belt_ranks where discipline = 'bjj' and name = 'White'),
    1,
    'Movement fundamentals',
    'Placeholder skill check: bridge, shrimp, technical stand-up.',
    'skill',
    null,
    0
  ),
  (
    (select id from public.belt_ranks where discipline = 'bjj' and name = 'White'),
    2,
    'Guard retention basics',
    'Placeholder coach assessment for guard recovery and retention.',
    'assessment',
    null,
    1
  ),
  (
    (select id from public.belt_ranks where discipline = 'bjj' and name = 'White'),
    3,
    'Submission chain',
    'Placeholder skill check: one safe chain from control to submission.',
    'skill',
    null,
    2
  ),
  (
    (select id from public.belt_ranks where discipline = 'bjj' and name = 'White'),
    4,
    'Coach approval',
    'Placeholder final stripe assessment before blue-belt candidate review.',
    'assessment',
    null,
    3
  )
on conflict (rank_id, stripe, title) do update
set description = excluded.description,
    type = excluded.type,
    attendance_target = excluded.attendance_target,
    unlock_after_stripe = excluded.unlock_after_stripe;

insert into public.milestones (name, unlock_days, category, icon, active)
values
  ('971 T-shirt', 10, 'attendance', 'shirt-outline', true),
  ('Recovery credit', 15, 'attendance', 'medkit-outline', true),
  ('Gloves credit', 30, 'attendance', 'fitness-outline', true),
  ('Gi contribution', 90, 'attendance', 'ribbon-outline', true)
on conflict (name) do update
set unlock_days = excluded.unlock_days,
    category = excluded.category,
    icon = excluded.icon,
    active = excluded.active;

insert into public.rewards_catalog
  (name, category, cost_points, active, unlock_rule, fulfillment, inventory, sort_order)
values
  ('Protein shake', 'cafeteria', 120, true, '{}'::jsonb, 'manual', null, 10),
  ('971 rashguard', 'gear', 800, true, '{}'::jsonb, 'manual', null, 20),
  (
    'Private session',
    'coaching',
    1500,
    true,
    '{"placeholder": true, "requiresTier": "silver"}'::jsonb,
    'manual',
    null,
    30
  ),
  (
    'Seminar seat',
    'events',
    2000,
    true,
    '{"placeholder": true, "requiresTier": "gold"}'::jsonb,
    'manual',
    null,
    40
  )
on conflict (name) do update
set category = excluded.category,
    cost_points = excluded.cost_points,
    active = excluded.active,
    unlock_rule = excluded.unlock_rule,
    fulfillment = excluded.fulfillment,
    inventory = excluded.inventory,
    sort_order = excluded.sort_order;

insert into public.lineage_entries (year_label, name, role, note, sort_order)
values
  ('1890s', 'Mitsuyo Maeda', 'Judoka and prizefighter', 'Brought grappling traditions across continents.', 10),
  ('1917', 'Carlos Gracie', 'Gracie family founder', 'Helped establish Brazilian Jiu Jitsu in Brazil.', 20),
  ('1930s', 'Helio Gracie', 'BJJ pioneer', 'Refined leverage-first jiu jitsu for smaller athletes.', 30),
  ('1990s', 'Rilion Gracie', '7th degree coral belt', 'Lineage placeholder pending final client confirmation.', 40),
  ('Today', 'Coach Tony Hoerhann', '971 lead coach', '5th degree black belt and academy lineage anchor.', 50)
on conflict (name) do update
set year_label = excluded.year_label,
    role = excluded.role,
    note = excluded.note,
    sort_order = excluded.sort_order;
