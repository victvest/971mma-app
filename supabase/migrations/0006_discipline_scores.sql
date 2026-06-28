-- Phase 1: placeholder storage for the Phase 7 discipline-score engine.

create table if not exists public.discipline_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score int not null default 0 check (score >= 0 and score <= 100),
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
