import { formatGymDisplay, formatGymTime12h, isGymToday, GYM_TIME_ZONE } from '@/core/time/gymTime';

function gymDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(new Date(iso));
}

function isGymYesterday(iso: string, now = new Date()): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return gymDayKey(iso) === gymDayKey(yesterday.toISOString());
}

/** Calendar day label — Today / Yesterday / weekday + date (no time). */
export function formatAttendanceHeadline(iso: string, now = new Date()): string {
  if (isGymToday(iso, now)) return 'Today';
  if (isGymYesterday(iso, now)) return 'Yesterday';
  // formatGymDisplay → "Wed, 5 Jan, 3:00 PM" — take weekday + date only
  const full = formatGymDisplay(iso);
  const withoutTime = full.includes(',') ? full.slice(0, full.lastIndexOf(',')).trim() : full;
  return withoutTime;
}

/** Clock time only (gym-local 12h). */
export function formatAttendanceTime(iso: string): string {
  return formatGymTime12h(iso);
}

/**
 * @deprecated Prefer composing headline + time in the row.
 * Kept for child status cards that only need a clock time for "today".
 */
export function formatAttendanceSubtitle(iso: string, now = new Date()): string {
  const time = formatAttendanceTime(iso);
  if (isGymToday(iso, now) || isGymYesterday(iso, now)) return time;
  return `${formatAttendanceHeadline(iso, now)} · ${time}`;
}

export {
  extractMindbodyVisitClassId,
  extractMindbodyVisitClassTitle,
} from '@/features/checkin/utils/mindbodyVisitPayload';

const CLASS_ROSTER_METHODS = new Set(['coach_roster', 'coach', 'manual', 'roll_call']);
const FACILITY_METHODS = new Set(['qr_scan', 'qr_self', 'gate_scan']);

/**
 * Member-facing check-in channel label from the real method — never invent "Coach roster"
 * for Mindbody-synced class visits.
 */
export function formatCheckInMethod(method: string): string {
  const normalized = method?.toLowerCase?.() ?? '';

  if (CLASS_ROSTER_METHODS.has(normalized)) {
    return 'Coach roster';
  }

  if (normalized === 'mindbody_visit') {
    return 'Synced';
  }

  if (FACILITY_METHODS.has(normalized)) {
    return 'Gate';
  }

  return 'Gate';
}
