-- Coach Roll Call (TINDER Phase 2): session-scoped class attendance.
-- Facility visits remain in check_ins until Entry Display; roll call writes here only.

-- ── roll_call_sessions ────────────────────────────────────────────────────────

create table if not exists public.roll_call_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed')),
  deck_cursor int not null default 0 check (deck_cursor >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roll_call_sessions_class_status
  on public.roll_call_sessions (class_id, status, started_at desc);

create index if not exists idx_roll_call_sessions_coach
  on public.roll_call_sessions (coach_id, created_at desc);

-- ── class_session_attendance ──────────────────────────────────────────────────

create table if not exists public.class_session_attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  mindbody_client_id text,
  status text not null
    check (status in ('present', 'absent', 'late', 'left_early', 'guest')),
  method text not null default 'roll_call'
    check (method in ('roll_call', 'walk_in', 'qr_scan', 'roster_list')),
  marked_by uuid not null references auth.users(id) on delete restrict,
  marked_at timestamptz not null default now(),
  roll_call_session_id uuid references public.roll_call_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_session_attendance_member_ref
    check (user_id is not null or mindbody_client_id is not null)
);

create unique index if not exists uq_class_session_attendance_user
  on public.class_session_attendance (class_id, user_id)
  where user_id is not null;

create unique index if not exists uq_class_session_attendance_mindbody
  on public.class_session_attendance (class_id, mindbody_client_id)
  where mindbody_client_id is not null;

create index if not exists idx_class_session_attendance_class
  on public.class_session_attendance (class_id, marked_at desc);

create index if not exists idx_class_session_attendance_user
  on public.class_session_attendance (user_id, marked_at desc)
  where user_id is not null;

-- ── updated_at ────────────────────────────────────────────────────────────────

create or replace function public.set_roll_call_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_roll_call_sessions_updated_at on public.roll_call_sessions;
create trigger trg_roll_call_sessions_updated_at
before update on public.roll_call_sessions
for each row execute function public.set_roll_call_updated_at();

drop trigger if exists trg_class_session_attendance_updated_at on public.class_session_attendance;
create trigger trg_class_session_attendance_updated_at
before update on public.class_session_attendance
for each row execute function public.set_roll_call_updated_at();

-- ── block direct member writes on attendance ────────────────────────────────

create or replace function public.enforce_roll_call_attendance_coach_writer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_class_session_attendance_coach_only on public.class_session_attendance;
create trigger trg_class_session_attendance_coach_only
before insert or update or delete on public.class_session_attendance
for each row execute function public.enforce_roll_call_attendance_coach_writer();

revoke all on function public.enforce_roll_call_attendance_coach_writer() from public;
grant execute on function public.enforce_roll_call_attendance_coach_writer() to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.roll_call_sessions enable row level security;
alter table public.class_session_attendance enable row level security;

-- Sessions: coach/admin only.
drop policy if exists "roll_call_sessions select coach" on public.roll_call_sessions;
create policy "roll_call_sessions select coach"
  on public.roll_call_sessions for select
  to authenticated
  using (public.is_coach_or_admin());

drop policy if exists "roll_call_sessions insert coach" on public.roll_call_sessions;
create policy "roll_call_sessions insert coach"
  on public.roll_call_sessions for insert
  to authenticated
  with check (public.is_coach_or_admin() and coach_id = auth.uid());

drop policy if exists "roll_call_sessions update coach" on public.roll_call_sessions;
create policy "roll_call_sessions update coach"
  on public.roll_call_sessions for update
  to authenticated
  using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

drop policy if exists "roll_call_sessions delete coach" on public.roll_call_sessions;
create policy "roll_call_sessions delete coach"
  on public.roll_call_sessions for delete
  to authenticated
  using (public.is_coach_or_admin());

-- Attendance: members read own rows; coaches/admins read/write all.
drop policy if exists "class_session_attendance select own" on public.class_session_attendance;
create policy "class_session_attendance select own"
  on public.class_session_attendance for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "class_session_attendance select coach" on public.class_session_attendance;
create policy "class_session_attendance select coach"
  on public.class_session_attendance for select
  to authenticated
  using (public.is_coach_or_admin());

drop policy if exists "class_session_attendance insert coach" on public.class_session_attendance;
create policy "class_session_attendance insert coach"
  on public.class_session_attendance for insert
  to authenticated
  with check (public.is_coach_or_admin() and marked_by = auth.uid());

drop policy if exists "class_session_attendance update coach" on public.class_session_attendance;
create policy "class_session_attendance update coach"
  on public.class_session_attendance for update
  to authenticated
  using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

drop policy if exists "class_session_attendance delete coach" on public.class_session_attendance;
create policy "class_session_attendance delete coach"
  on public.class_session_attendance for delete
  to authenticated
  using (public.is_coach_or_admin());
