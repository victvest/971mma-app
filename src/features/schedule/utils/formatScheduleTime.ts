import {
  formatGymTime12h,
  formatGymWeekdayShort,
  gymHour24,
  isGymToday,
} from '@/core/time/gymTime';

function todayCardLabel(iso: string, now: Date): string {
  if (new Date(iso).getTime() < now.getTime()) return 'TODAY';
  return gymHour24(iso) >= 17 ? 'TONIGHT' : 'TODAY';
}

function isGymTomorrow(iso: string, now = new Date()): boolean {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(d);
  return day(new Date(iso)) === day(tomorrow);
}

export function formatScheduleCardTime(iso: string, now = new Date()): string {
  const { label, time } = parseScheduleCardTime(iso, now);
  return `${label} ${time}`;
}

export type ScheduleCardTime = {
  label: string;
  time: string;
};

export function parseScheduleCardTime(iso: string, now = new Date()): ScheduleCardTime {
  const time = formatGymTime12h(iso);

  if (isGymToday(iso, now)) {
    return { label: todayCardLabel(iso, now), time };
  }

  if (isGymTomorrow(iso, now)) {
    return { label: 'TOMORROW', time };
  }

  return { label: formatGymWeekdayShort(iso), time };
}
