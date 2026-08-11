import {
  extractMindbodyVisitClassId,
  extractMindbodyVisitClassTitle,
} from '@/features/checkin/utils/mindbodyVisitPayload';
import { isGymToday } from '@/core/time/gymTime';
import type { CheckInRow } from '@/types/database';

const FACILITY_METHODS = new Set(['qr_scan', 'qr_self', 'gate_scan']);
const CLASS_ROSTER_METHODS = new Set(['coach_roster', 'coach', 'manual', 'roll_call']);

/**
 * True when a check_ins row represents class attendance (roster / mapped class / MB class visit),
 * not a bare facility gate entry.
 */
export function isClassLinkedCheckIn(item: CheckInRow): boolean {
  if (item.class_id) return true;
  if (item.classes) return true;

  const method = item.method?.toLowerCase?.() ?? '';
  if (CLASS_ROSTER_METHODS.has(method)) return true;
  if (method === 'mindbody_visit') return true;

  if (extractMindbodyVisitClassTitle(item.raw_payload)) return true;
  if (extractMindbodyVisitClassId(item.raw_payload)) return true;

  return false;
}

/** Facility / gate visits only — excludes class-linked rows. */
export function isFacilityCheckIn(item: CheckInRow): boolean {
  return !isClassLinkedCheckIn(item);
}

export function isFacilityMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return FACILITY_METHODS.has(method.toLowerCase());
}

export function isClassRosterMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return CLASS_ROSTER_METHODS.has(method.toLowerCase());
}

/** Mindbody / roster rows that did not count as training attendance. */
export function isNonCountedCheckIn(item: CheckInRow): boolean {
  return item.missed === true || item.late_cancelled === true || item.signed_in === false;
}

/**
 * Member "arrived today" for check-in UI — any gym-day check-in that counts
 * (facility entry, roster present, or synced visit that was signed in).
 */
export function isArrivedTodayCheckIn(item: CheckInRow, now = new Date()): boolean {
  if (!isGymToday(item.checked_in_at, now)) return false;
  if (isNonCountedCheckIn(item)) return false;
  return true;
}

/** Latest counted arrival today (by `checked_in_at`) — drives "checked in today" state. */
export function findTodaysArrival(
  checkIns: CheckInRow[],
  now = new Date(),
): CheckInRow | undefined {
  let latest: CheckInRow | undefined;
  for (const row of checkIns) {
    if (!isArrivedTodayCheckIn(row, now)) continue;
    if (!latest || row.checked_in_at > latest.checked_in_at) {
      latest = row;
    }
  }
  return latest;
}

/**
 * Latest facility / gate arrival today — drives the member card "ARRIVED · time"
 * so re-entries update the displayed clock.
 */
export function findLatestFacilityArrivalToday(
  checkIns: CheckInRow[],
  now = new Date(),
): CheckInRow | undefined {
  let latest: CheckInRow | undefined;
  for (const row of checkIns) {
    if (!isArrivedTodayCheckIn(row, now)) continue;
    if (!isFacilityCheckIn(row) && !isFacilityMethod(row.method)) continue;
    if (!latest || row.checked_in_at > latest.checked_in_at) {
      latest = row;
    }
  }
  return latest;
}
