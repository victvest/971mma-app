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

export function formatCheckInMethod(method: string): string {
  switch (method.toLowerCase()) {
    case 'qr':
      return 'QR scan';
    case 'self':
      return 'Self check-in';
    case 'manual':
      return 'Manual';
    case 'coach':
      return 'Coach scan';
    case 'gate_scan':
      return 'Entrance scan';
    case 'qr_self':
      return 'Self check-in';
    case 'qr_scan':
      return 'QR scan';
    case 'coach_roster':
      return 'Coach roster';
    case 'mindbody_visit':
      return 'Mindbody visit';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}
