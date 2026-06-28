-- Phase 1: Mindbody identity bridge and static/semi-static mirror tables.

create table if not exists public.mindbody_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mindbody_client_id text not null unique,
  mindbody_unique_id text,
  linked_at timestamptz not null default now(),
  link_method text not null
    check (link_method in ('matched_email', 'matched_phone', 'created', 'manual'))
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  mindbody_program_id text unique,
  name text not null,
  discipline text,
  session_type_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  mindbody_staff_id text unique,
  name text not null,
  specialty text,
  rank text,
  rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  bio text,
  photo_url text,
  is_head_coach boolean not null default false,
  sort_order int not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_programs_active_name on public.programs (active, name);
create index if not exists idx_coaches_sort on public.coaches (is_head_coach desc, sort_order, name);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_program_id_fkey'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_program_id_fkey
      foreign key (program_id) references public.programs(id) on delete set null;
  end if;
end $$;
