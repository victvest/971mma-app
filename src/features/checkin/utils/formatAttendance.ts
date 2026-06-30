import { formatGymDisplay, isGymToday, GYM_TIME_ZONE } from '@/core/time/gymTime';

function gymDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(new Date(iso));
}

function isGymYesterday(iso: string, now = new Date()): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return gymDayKey(iso) === gymDayKey(yesterday.toISOString());
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatAttendanceHeadline(iso: string, now = new Date()): string {
  if (isGymToday(iso, now)) return 'Today';
  if (isGymYesterday(iso, now)) return 'Yesterday';
  return formatGymDisplay(iso).split(',')[0] ?? formatGymDisplay(iso);
}

export function formatAttendanceSubtitle(iso: string, now = new Date()): string {
  const time = formatTime(iso);
  if (isGymToday(iso, now) || isGymYesterday(iso, now)) return time;
  const full = formatGymDisplay(iso);
  const datePart = full.includes(',') ? full.slice(full.indexOf(',') + 1).trim() : full;
  return `${datePart} · ${time}`;
}

function readNestedString(payload: Record<string, unknown>, keys: string[]): string | null {
  let current: unknown = payload;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

/** Mindbody visit class title when check_ins.class_id is null (unmapped schedule row). */
export function extractMindbodyVisitClassTitle(
  rawPayload: Record<string, unknown> | null | undefined,
): string | null {
  if (!rawPayload) return null;

  return (
    readNestedString(rawPayload, ['ClassDescription', 'Name']) ??
    readNestedString(rawPayload, ['Class', 'ClassDescription', 'Name']) ??
    readNestedString(rawPayload, ['Class', 'Name']) ??
    readNestedString(rawPayload, ['Name']) ??
    null
  );
}

const COACH_ROSTER_METHODS = new Set(['coach_roster', 'coach', 'manual']);

/** Member-facing check-in channel — only Gate or Coach roster. */
export function formatCheckInMethod(method: string, options?: { hasClass?: boolean }): string {
  const normalized = method.toLowerCase();

  if (COACH_ROSTER_METHODS.has(normalized)) {
    return 'Coach roster';
  }

  if (normalized === 'qr_scan' || normalized === 'mindbody_visit') {
    return options?.hasClass ? 'Coach roster' : 'Gate';
  }

  return 'Gate';
}
