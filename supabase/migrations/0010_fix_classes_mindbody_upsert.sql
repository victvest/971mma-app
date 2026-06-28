-- Fix Mindbody class mirror upserts: partial unique index cannot back ON CONFLICT.
-- Also hide legacy MCP seed rows from the schedule (no mindbody_class_id → not bookable).

drop index if exists public.idx_classes_mindbody_class_id;

alter table public.classes
  drop constraint if exists classes_mindbody_class_id_key;

alter table public.classes
  add constraint classes_mindbody_class_id_key unique (mindbody_class_id);

update public.classes
set is_cancelled = true
where mindbody_class_id is null;
