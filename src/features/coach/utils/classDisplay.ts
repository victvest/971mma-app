import { formatGymDisplay, formatGymTime12h, gymDayKey, parseGymTime12h } from '@/core/time/gymTime';

/** Coach-facing capacity copy — avoids implying members can book in-app. */
export function formatCoachRosterCapacity(bookedCount: number, capacity: number): string {
  if (capacity > 0) {
    return `${bookedCount}/${capacity} on roster`;
  }
  return `${bookedCount} on roster`;
}

/** Roll call summary subtitle — "No-Gi Fundamentals · Tonight 7:00 PM" */
export function formatRollCallSummarySubtitle(classTitle: string, startsAt: string): string {
  const title = classTitle.trim() || 'Class';
  const isToday = gymDayKey() === gymDayKey(new Date(startsAt));
  const scheduleLabel = isToday
    ? `Tonight ${formatGymTime12h(startsAt)}`
    : formatRunClassSchedule(startsAt);
  return `${title} · ${scheduleLabel}`;
}

/** Run class hero — "Thu, 25 Jun • 8:51 PM" */
export function formatRunClassSchedule(iso: string): string {
  const full = formatGymDisplay(iso);
  const lastComma = full.lastIndexOf(',');
  if (lastComma === -1) return full;
  return `${full.slice(0, lastComma)} • ${full.slice(lastComma + 2)}`;
}

export type RunClassRosterStat = {
  bookedLabel: string;
  capacitySuffix: string;
};

/** Run class stat row — "14" + " /24" */
export function formatRunClassRosterStat(bookedCount: number, capacity: number): RunClassRosterStat {
  if (capacity > 0) {
    return { bookedLabel: String(bookedCount), capacitySuffix: ` /${capacity}` };
  }
  return { bookedLabel: String(bookedCount), capacitySuffix: '' };
}

export function formatCoachClassTime(iso: string): string {
  return formatGymTime12h(iso);
}

export function parseCoachClassTime(iso: string) {
  return parseGymTime12h(iso);
}

/** Avoid "Coach Coach …" when Mindbody names already include a title prefix. */
export function formatClassCoachLabel(coachName: string): string {
  const trimmed = coachName.trim();
  if (!trimmed) return '';
  if (/^coach\b/i.test(trimmed)) return trimmed;
  return `Coach ${trimmed}`;
}
