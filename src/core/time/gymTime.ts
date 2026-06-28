
export const GYM_TIME_ZONE = 'Asia/Dubai';

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GYM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function gymParts(date: Date) {
  const parts = dateTimeFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function formatGymDateTime(date: Date): string {
  const { year, month, day, hour, minute, second } = gymParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

const GYM_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const GYM_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function gymHour24(iso: string): number {
  return Number(gymParts(new Date(iso)).hour);
}

/** Gym-local clock time for member-facing schedule UI (e.g. `8 AM`, `7:30 PM`). */
export type GymTime12hParts = {
  clock: string;
  period: string;
};

export function parseGymTime12h(iso: string): GymTime12hParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso));

  const hour = parts.find((part) => part.type === 'hour')?.value ?? '12';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const period = parts.find((part) => part.type === 'dayPeriod')?.value?.toUpperCase() ?? 'AM';
  const clock = minute === '00' ? hour : `${hour}:${minute}`;

  return { clock, period };
}

export function formatGymTime12h(iso: string): string {
  const { clock, period } = parseGymTime12h(iso);
  return `${clock} ${period}`;
}

/**
 * Compact class duration — minutes under 2h (`60m`, `90m`), then hours (`2h`, `2h 30m`).
 */
export function formatDurationShort(minutes: number): string {
  const safe = Math.max(1, Math.round(minutes));
  if (safe < 120) return `${safe}m`;

  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function formatGymDisplay(iso: string): string {
  const parts = gymParts(new Date(iso));
  const noonGym = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00+04:00`);
  const weekday = GYM_WEEKDAYS[noonGym.getUTCDay()];
  const month = GYM_MONTHS[Math.max(0, Number(parts.month) - 1)];
  const day = Number(parts.day);
  return `${weekday}, ${day} ${month}, ${formatGymTime12h(iso)}`;
}

export function formatGymWeekdayShort(iso: string): string {
  const parts = gymParts(new Date(iso));
  const noonGym = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00+04:00`);
  return GYM_WEEKDAYS[noonGym.getUTCDay()].toUpperCase();
}

export function formatGymEndDisplay(startsAt: string, durationMinutes: number): string {
  const end = new Date(new Date(startsAt).getTime() + durationMinutes * 60_000);
  return formatGymDisplay(end.toISOString());
}

export function formatLocalDisplay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function isGymToday(iso: string, now = new Date()): boolean {
  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(d);
  return day(new Date(iso)) === day(now);
}

export function isClassLiveNow(
  startsAt: string,
  durationMinutes: number,
  now = new Date(),
): boolean {
  const startMs = new Date(startsAt).getTime();
  const endMs = startMs + durationMinutes * 60_000;
  const nowMs = now.getTime();
  return nowMs >= startMs && nowMs <= endMs;
}

export function isClassUpcoming(startsAt: string, now = new Date()): boolean {
  return new Date(startsAt).getTime() > now.getTime();
}

/** True when class end time has passed (L9 post-class corrections). */
export function isClassEnded(
  startsAt: string,
  durationMinutes: number,
  now = new Date(),
): boolean {
  const endMs = new Date(startsAt).getTime() + durationMinutes * 60_000;
  return now.getTime() > endMs;
}

/** True when class starts more than `thresholdMinutes` from now (L8). */
export function isClassEarly(
  startsAt: string,
  thresholdMinutes = 15,
  now = new Date(),
): boolean {
  const startMs = new Date(startsAt).getTime();
  return startMs - now.getTime() > thresholdMinutes * 60_000;
}

export function gymDayBoundsIso(now = new Date()): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(now);
  return {
    start: new Date(`${today}T00:00:00+04:00`).toISOString(),
    end: new Date(`${today}T23:59:59.999+04:00`).toISOString(),
  };
}

/** Gym-local calendar day key (`YYYY-MM-DD`) — use to detect day rollovers for schedule sync. */
export function gymDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(now);
}

/** Gym-local today as Mindbody `startDate` / `endDate` strings (schedule sync, single day). */
export function gymTodayRange(now = new Date()): { startDate: string; endDate: string } {
  const today = gymParts(now);
  const start = new Date(`${today.year}-${today.month}-${today.day}T00:00:00+04:00`);
  const end = new Date(`${today.year}-${today.month}-${today.day}T23:59:59+04:00`);

  return {
    startDate: formatGymDateTime(start),
    endDate: formatGymDateTime(end),
  };
}

/** Gym-local tomorrow as Mindbody `startDate` / `endDate` strings. */
export function gymTomorrowRange(now = new Date()): { startDate: string; endDate: string } {
  const todayMs = new Date(`${gymParts(now).year}-${gymParts(now).month}-${gymParts(now).day}T12:00:00+04:00`).getTime();
  const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;
  const tomorrow = gymParts(new Date(tomorrowMs));
  const start = new Date(`${tomorrow.year}-${tomorrow.month}-${tomorrow.day}T00:00:00+04:00`);
  const end = new Date(`${tomorrow.year}-${tomorrow.month}-${tomorrow.day}T23:59:59+04:00`);

  return {
    startDate: formatGymDateTime(start),
    endDate: formatGymDateTime(end),
  };
}

/**
 * Gym-local today + tomorrow as Mindbody `startDate` / `endDate` strings.
 * Use this for schedule sync — product shows today and tomorrow only.
 */
export function gymTodayTomorrowRange(now = new Date()): { startDate: string; endDate: string } {
  const todayParts = gymParts(now);
  const todayNoonMs = new Date(`${todayParts.year}-${todayParts.month}-${todayParts.day}T12:00:00+04:00`).getTime();
  const tomorrowNoonMs = todayNoonMs + 24 * 60 * 60 * 1000;
  const tomorrowParts = gymParts(new Date(tomorrowNoonMs));

  const start = new Date(`${todayParts.year}-${todayParts.month}-${todayParts.day}T00:00:00+04:00`);
  const end = new Date(`${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}T23:59:59+04:00`);

  return {
    startDate: formatGymDateTime(start),
    endDate: formatGymDateTime(end),
  };
}

/** @deprecated Prefer `gymTodayRange` or `gymTodayTomorrowRange`. */
export function gymWeekRange(now = new Date()): { startDate: string; endDate: string } {
  return gymTodayTomorrowRange(now);
}

/**
 * Gym-local today + tomorrow as ISO strings for DB queries.
 * The schedule shows today and tomorrow — both days are fetched in one range.
 */
export function gymRangeIso(now = new Date()): { fromISO: string; toISO: string } {
  const todayParts = gymParts(now);
  const todayNoonMs = new Date(`${todayParts.year}-${todayParts.month}-${todayParts.day}T12:00:00+04:00`).getTime();
  const tomorrowNoonMs = todayNoonMs + 24 * 60 * 60 * 1000;
  const tomorrowParts = gymParts(new Date(tomorrowNoonMs));

  const fromISO = new Date(`${todayParts.year}-${todayParts.month}-${todayParts.day}T00:00:00+04:00`).toISOString();
  const toISO = new Date(`${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}T23:59:59.999+04:00`).toISOString();

  return { fromISO, toISO };
}
