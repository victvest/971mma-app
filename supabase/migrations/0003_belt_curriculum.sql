-- Phase 1: custom belt curriculum and promotion tracking.

create table if not exists public.belt_ranks (
  id uuid primary key default gen_random_uuid(),
  discipline text not null,
  name text not null,
  "order" int not null,
  stripes int not null default 4 check (stripes >= 0),
  created_at timestamptz not null default now(),
  unique (discipline, "order"),
  unique (discipline, name)
);

create table if not exists public.belt_requirements (
  id uuid primary key default gen_random_uuid(),
  rank_id uuid not null references public.belt_ranks(id) on delete cascade,
  stripe int not null default 0 check (stripe >= 0),
  title text not null,
  description text,
  type text not null check (type in ('attendance', 'skill', 'assessment')),
  attendance_target int check (attendance_target is null or attendance_target > 0),
  unlock_after_stripe int check (unlock_after_stripe is null or unlock_after_stripe >= 0),
  created_at timestamptz not null default now(),
  unique (rank_id, stripe, title)
);

create table if not exists public.member_belt_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  discipline text not null,
  rank_id uuid references public.belt_ranks(id) on delete set null,
  stripe int not null default 0 check (stripe >= 0),
  percent numeric(5, 2) not null default 0 check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, discipline)
);

create table if not exists public.member_requirement_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  requirement_id uuid not null references public.belt_requirements(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'now', 'done')),
  assessed_by uuid references auth.users(id) on delete set null,
  assessed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discipline text not null,
  from_rank uuid references public.belt_ranks(id) on delete set null,
  to_rank uuid references public.belt_ranks(id) on delete set null,
  from_stripe int check (from_stripe is null or from_stripe >= 0),
  to_stripe int check (to_stripe is null or to_stripe >= 0),
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now()
);

create index if not exists idx_belt_requirements_rank
  on public.belt_requirements (rank_id, stripe);
create index if not exists idx_promotions_user_time
  on public.promotions (user_id, awarded_at desc);
