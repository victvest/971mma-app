-- Facility check-in integrity: at most one gate/QR facility entry per member per gym-day.
--
-- Context (see docs/CHECKIN_AUDIT.md, findings #3 and #7): "one visit per gym day" was
-- enforced only by application-level SELECT-then-INSERT in the SALTO gate path and in
-- mb-checkin. That is not atomic — two near-simultaneous reader scans (double read,
-- retry, or gate + coach path at once) both see "no check-in today" and both insert,
-- which double-awards check-in points (points are keyed per row) and inflates
-- member_streaks.total_check_ins. This adds the DB-level backstop that was missing.
--
-- Implementation note: the gym day is the Asia/Dubai calendar date. `timestamptz AT
-- TIME ZONE 'Asia/Dubai'` is only STABLE, not IMMUTABLE, so it cannot be used directly
-- in an index expression or a generated column. We therefore materialise a plain
-- `gym_day date` column, backfill it, keep it correct with a BEFORE trigger, and put a
-- partial unique index on (user_id, gym_day) for facility-entry methods only.
--
-- Scope: ONLY facility-entry methods ('gate_scan', 'qr_scan'). Class-visit mirror rows
-- ('mindbody_visit') and roster marks ('coach_roster'/'roll_call') are intentionally
-- excluded — a member can legitimately have a class visit AND a facility entry on the
-- same day, and the coach-roster path already has its own per-class unique index
-- (idx_check_ins_coach_roster_class_once, migration 0053).

-- 1. Materialised gym-day column (Asia/Dubai date of checked_in_at).
alter table public.check_ins
  add column if not exists gym_day date;

comment on column public.check_ins.gym_day is
  'Asia/Dubai calendar date of checked_in_at. Maintained by trg_check_ins_set_gym_day; '
  'backs the one-facility-entry-per-day unique index.';

-- 2. Keep gym_day in lockstep with checked_in_at on every write.
create or replace function public.set_check_in_gym_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.gym_day := (coalesce(new.checked_in_at, now()) at time zone 'Asia/Dubai')::date;
  return new;
end;
$$;

drop trigger if exists trg_check_ins_set_gym_day on public.check_ins;
create trigger trg_check_ins_set_gym_day
  before insert or update of checked_in_at on public.check_ins
  for each row
  execute function public.set_check_in_gym_day();

-- 3. Backfill existing rows.
update public.check_ins
set gym_day = (checked_in_at at time zone 'Asia/Dubai')::date
where gym_day is null;

-- 4. Collapse any pre-existing same-day facility duplicates so the unique index can be
--    built. Keep the earliest row per (user, gym-day) — it owns the awarded check-in
--    points (points ledger ref_id points at that row id). Deleting later duplicates
--    cascades to gate_access_attempts.check_in_id via ON DELETE SET NULL.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, gym_day
      order by checked_in_at asc, id asc
    ) as rn
  from public.check_ins
  where method in ('gate_scan', 'qr_scan')
)
delete from public.check_ins ci
using ranked r
where ci.id = r.id
  and r.rn > 1;

-- 5. Enforce one facility entry per member per gym-day going forward.
create unique index if not exists idx_check_ins_facility_once_per_day
  on public.check_ins (user_id, gym_day)
  where method in ('gate_scan', 'qr_scan');

comment on index public.idx_check_ins_facility_once_per_day is
  'At most one gate_scan/qr_scan facility check-in per member per Asia/Dubai gym-day. '
  'The gate path relies on this to make concurrent scans a no-op instead of a duplicate.';
