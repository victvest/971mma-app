-- Phase 1: loyalty points, milestones, rewards catalog, and redemption rows.

create table if not exists public.points_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('check_in', 'redeem', 'bonus', 'adjustment', 'milestone')),
  ref_id uuid,
  balance_after int not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unlock_days int not null check (unlock_days > 0),
  category text,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.member_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'next', 'earned')),
  earned_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

create table if not exists public.rewards_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('cafeteria', 'gear', 'coaching', 'events')),
  cost_points int not null check (cost_points > 0),
  active boolean not null default true,
  unlock_rule jsonb not null default '{}'::jsonb,
  fulfillment text not null default 'manual' check (fulfillment in ('manual', 'mindbody')),
  inventory int check (inventory is null or inventory >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.rewards_catalog(id) on delete restrict,
  cost_points int not null check (cost_points > 0),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled', 'refunded')),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_ledger_user_time
  on public.points_ledger (user_id, created_at desc);
create unique index if not exists idx_points_ledger_reason_ref
  on public.points_ledger (reason, ref_id)
  where ref_id is not null;
create index if not exists idx_rewards_catalog_active_sort
  on public.rewards_catalog (active, sort_order, name);
create index if not exists idx_redemptions_user_time
  on public.redemptions (user_id, created_at desc);
