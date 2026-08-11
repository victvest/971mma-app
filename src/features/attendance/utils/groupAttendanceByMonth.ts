import { GYM_TIME_ZONE } from '@/core/time/gymTime';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: GYM_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

export function attendanceMonthKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso));
}

export function formatAttendanceMonthLabel(iso: string): string {
  return MONTH_FORMATTER.format(new Date(iso));
}

export type AttendanceListMonthHeader = {
  kind: 'month';
  id: string;
  label: string;
};

export type AttendanceListRow<T> = {
  kind: 'row';
  id: string;
  timestamp: string;
  item: T;
};

export type AttendanceListEntry<T> = AttendanceListMonthHeader | AttendanceListRow<T>;

/**
 * Insert month headers into a reverse-chronological attendance list (Nike / Apple Fitness pattern).
 */
export function groupAttendanceByMonth<T extends { id: string; timestamp: string }>(
  items: T[],
): AttendanceListEntry<T>[] {
  const entries: AttendanceListEntry<T>[] = [];
  let lastMonthKey: string | null = null;

  for (const item of items) {
    const monthKey = attendanceMonthKey(item.timestamp);
    if (monthKey !== lastMonthKey) {
      entries.push({
        kind: 'month',
        id: `month-${monthKey}`,
        label: formatAttendanceMonthLabel(item.timestamp),
      });
      lastMonthKey = monthKey;
    }
    entries.push({
      kind: 'row',
      id: item.id,
      timestamp: item.timestamp,
      item,
    });
  }

  return entries;
}
