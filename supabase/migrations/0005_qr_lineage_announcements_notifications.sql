-- Phase 1: QR token persistence, static lineage content, announcements, notifications.

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jti uuid not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lineage_entries (
  id uuid primary key default gen_random_uuid(),
  year_label text not null,
  name text not null unique,
  role text,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  channel text not null default 'general',
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_tokens_user_expiry
  on public.qr_tokens (user_id, expires_at desc);
create index if not exists idx_lineage_entries_sort
  on public.lineage_entries (sort_order, year_label);
create index if not exists idx_announcements_created
  on public.announcements (created_at desc);
create index if not exists idx_notifications_user_time
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;
