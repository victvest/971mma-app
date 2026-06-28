-- Phase 1: extend the existing app tables for Mindbody mirror data and roles.

alter table public.profiles
  add column if not exists role text not null default 'member'
    check (role in ('member', 'coach', 'admin')),
  add column if not exists member_since timestamptz,
  add column if not exists mindbody_synced_at timestamptz;

alter table public.classes
  add column if not exists mindbody_class_id text,
  add column if not exists program_id uuid,
  add column if not exists staff_mindbody_id text,
  add column if not exists booked_count int not null default 0,
  add column if not exists is_available boolean not null default true,
  add column if not exists is_waitlist_available boolean not null default false,
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists last_synced_at timestamptz;

alter table public.check_ins
  add column if not exists mindbody_visit_id text,
  add column if not exists source text not null default 'supabase'
    check (source in ('supabase', 'mindbody'));

create unique index if not exists idx_classes_mindbody_class_id
  on public.classes (mindbody_class_id)
  where mindbody_class_id is not null;

create unique index if not exists idx_check_ins_mindbody_visit_id
  on public.check_ins (mindbody_visit_id)
  where mindbody_visit_id is not null;

create index if not exists idx_classes_starts_at on public.classes (starts_at);
create index if not exists idx_classes_discipline on public.classes (discipline);
create index if not exists idx_check_ins_user_time
  on public.check_ins (user_id, checked_in_at desc);
