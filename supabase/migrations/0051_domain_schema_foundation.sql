-- Migration: 0051_domain_schema_foundation.sql
-- Create disciplines, member_disciplines, and coach_disciplines tables, alter programs/classes/coaches, add indexes, and perform backfill.

-- 1. Create disciplines table
create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('bjj','wrestling','muay_thai','mma','boxing','performance_fitness','personal_training','yoga_mobility')),
  display_name text not null,
  has_rank_progression boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed disciplines
insert into public.disciplines (slug, display_name, has_rank_progression, sort_order)
values
  ('bjj', 'Brazilian Jiu-Jitsu', true, 10),
  ('wrestling', 'Wrestling', true, 20),
  ('muay_thai', 'Muay Thai / Striking', false, 30),
  ('mma', 'Mixed Martial Arts', false, 40),
  ('boxing', 'Boxing', false, 50),
  ('performance_fitness', 'Performance & Fitness', false, 60),
  ('personal_training', 'Personal Training', false, 70),
  ('yoga_mobility', 'Yoga & Mobility', false, 80)
on conflict (slug) do update
set display_name = excluded.display_name,
    has_rank_progression = excluded.has_rank_progression,
    sort_order = excluded.sort_order;

-- 2. Create member_disciplines table
create table if not exists public.member_disciplines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  source text not null check (source in ('mindbody_membership','mindbody_contract','admin_override')),
  mindbody_membership_id text,
  active boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, discipline_id, source, mindbody_membership_id)
);

-- 3. Create coach_disciplines table
create table if not exists public.coach_disciplines (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, discipline_id)
);

-- 4. Alter coaches table to add user_id and rich profile fields
alter table public.coaches
  add column if not exists user_id uuid unique references public.profiles(id) on delete set null,
  add column if not exists coaching_philosophy text,
  add column if not exists years_experience int check (years_experience >= 0),
  add column if not exists fight_record text,
  add column if not exists titles jsonb not null default '[]'::jsonb,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists languages text[] not null default '{}',
  add column if not exists active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- 5. Alter programs table to add discipline_id
alter table public.programs
  add column if not exists discipline_id uuid references public.disciplines(id) on delete set null;

-- 6. Alter classes table to add discipline_id and coach_id
alter table public.classes
  add column if not exists discipline_id uuid references public.disciplines(id) on delete set null,
  add column if not exists coach_id uuid references public.coaches(id) on delete set null;

-- 7. Create Indexes
create index if not exists idx_member_disciplines_user_active on public.member_disciplines(user_id, active);
create index if not exists idx_member_disciplines_discipline_active on public.member_disciplines(discipline_id, active);
create index if not exists idx_coach_disciplines_coach on public.coach_disciplines(coach_id);
create index if not exists idx_coach_disciplines_discipline on public.coach_disciplines(discipline_id);
create index if not exists idx_classes_discipline_id_starts_at on public.classes(discipline_id, starts_at);
create index if not exists idx_classes_coach_id_starts_at on public.classes(coach_id, starts_at);
create index if not exists idx_programs_discipline_id on public.programs(discipline_id);
create index if not exists idx_coaches_user_id on public.coaches(user_id);

-- 8. Backfill existing string-based discipline mappings on programs and classes
-- Mappings helper:
-- BJJ: jiu, bjj
-- Wrestling: wrest
-- Muay Thai: muay, thai, strik
-- MMA: mma, mixed
-- Boxing: box
-- Personal Training: personal, pt
-- Yoga & Mobility: yoga, mobil, stretch
-- Performance/Fitness: fit, strength, cond, performance, other
update public.programs p
set discipline_id = d.id
from public.disciplines d
where d.slug = case
  when p.discipline ilike '%jiu%' or p.discipline ilike '%bjj%' then 'bjj'
  when p.discipline ilike '%wrest%' then 'wrestling'
  when p.discipline ilike '%muay%' or p.discipline ilike '%thai%' or p.discipline ilike '%strik%' then 'muay_thai'
  when p.discipline ilike '%mma%' or p.discipline ilike '%mixed%' then 'mma'
  when p.discipline ilike '%box%' then 'boxing'
  when p.discipline ilike '%personal%' or p.discipline ilike '%pt%' then 'personal_training'
  when p.discipline ilike '%yoga%' or p.discipline ilike '%mobil%' or p.discipline ilike '%stretch%' then 'yoga_mobility'
  else 'performance_fitness'
end
and p.discipline_id is null;

update public.classes c
set discipline_id = d.id
from public.disciplines d
where d.slug = case
  when c.discipline ilike '%jiu%' or c.discipline ilike '%bjj%' then 'bjj'
  when c.discipline ilike '%wrest%' then 'wrestling'
  when c.discipline ilike '%muay%' or c.discipline ilike '%thai%' or c.discipline ilike '%strik%' then 'muay_thai'
  when c.discipline ilike '%mma%' or c.discipline ilike '%mixed%' then 'mma'
  when c.discipline ilike '%box%' then 'boxing'
  when c.discipline ilike '%personal%' or c.discipline ilike '%pt%' then 'personal_training'
  when c.discipline ilike '%yoga%' or c.discipline ilike '%mobil%' or c.discipline ilike '%stretch%' then 'yoga_mobility'
  else 'performance_fitness'
end
and c.discipline_id is null;

-- Backfill coach_id in classes by name matching
update public.classes c
set coach_id = co.id
from public.coaches co
where ((c.staff_mindbody_id = co.mindbody_staff_id and co.mindbody_staff_id is not null)
   or (lower(trim(c.coach_name)) = lower(trim(co.name))))
and c.coach_id is null;

-- 9. Enable RLS and setup policies
alter table public.disciplines enable row level security;
alter table public.member_disciplines enable row level security;
alter table public.coach_disciplines enable row level security;

-- disciplines policies
create policy "anyone can select active disciplines"
  on public.disciplines
  for select
  using (active = true);

create policy "admins manage disciplines"
  on public.disciplines
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- member_disciplines policies
create policy "users select own member_disciplines"
  on public.member_disciplines
  for select
  using (auth.uid() = user_id);

create policy "admins manage member_disciplines"
  on public.member_disciplines
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- coach_disciplines policies
create policy "anyone can select coach_disciplines"
  on public.coach_disciplines
  for select
  using (true);

create policy "admins manage coach_disciplines"
  on public.coach_disciplines
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
