import type { CheckInRow } from '@/types/database';
import {
  findLatestFacilityArrivalToday,
  findTodaysArrival,
  isArrivedTodayCheckIn,
  isClassLinkedCheckIn,
  isFacilityCheckIn,
} from '@/features/attendance/utils/classifyCheckIn';
import { unifyClassAttendance } from '@/features/attendance/utils/unifyClassAttendance';
import { groupAttendanceByMonth } from '@/features/attendance/utils/groupAttendanceByMonth';
import {
  formatAttendanceHeadline,
  formatAttendanceTime,
  formatCheckInMethod,
  extractMindbodyVisitClassTitle,
} from '@/features/checkin/utils/formatAttendance';
import type { ClassSessionAttendanceRow } from '@/services/database/classAttendance.repository';

function makeCheckIn(overrides: Partial<CheckInRow> & { id: string }): CheckInRow {
  return {
    user_id: 'u1',
    class_id: null,
    checked_in_at: '2026-07-22T08:00:00.000Z',
    method: 'gate_scan',
    mindbody_visit_id: null,
    source: 'app',
    ...overrides,
  } as CheckInRow;
}

function makeRollCall(
  overrides: Partial<ClassSessionAttendanceRow> & { id: string; classId: string },
): ClassSessionAttendanceRow {
  return {
    userId: 'u1',
    status: 'present',
    method: 'roll_call',
    markedAt: '2026-07-22T09:00:00.000Z',
    classTitle: 'BJJ Fundamentals',
    classDiscipline: 'BJJ',
    classStartsAt: '2026-07-22T09:00:00.000Z',
    ...overrides,
  };
}

describe('classifyCheckIn', () => {
  it('treats bare gate scans as facility', () => {
    const row = makeCheckIn({ id: '1', method: 'gate_scan' });
    expect(isFacilityCheckIn(row)).toBe(true);
    expect(isClassLinkedCheckIn(row)).toBe(false);
  });

  it('treats coach_roster with class_id as class-linked', () => {
    const row = makeCheckIn({
      id: '2',
      method: 'coach_roster',
      class_id: 'class-1',
      classes: { id: 'class-1', title: 'Muay Thai' } as CheckInRow['classes'],
    });
    expect(isClassLinkedCheckIn(row)).toBe(true);
    expect(isFacilityCheckIn(row)).toBe(false);
  });

  it('treats all mindbody_visit rows as class-linked (MB visits API is class attendance)', () => {
    const row = makeCheckIn({
      id: 'mb-bare',
      method: 'mindbody_visit',
      raw_payload: { Id: 99, SignedIn: true },
    });
    expect(isClassLinkedCheckIn(row)).toBe(true);
    expect(isFacilityCheckIn(row)).toBe(false);
  });

  it('treats mindbody visits with class title payload as class-linked', () => {
    const row = makeCheckIn({
      id: '3',
      method: 'mindbody_visit',
      raw_payload: { ClassDescription: { Name: 'Kids Kickboxing' } },
    });
    expect(isClassLinkedCheckIn(row)).toBe(true);
    expect(extractMindbodyVisitClassTitle(row.raw_payload)).toBe('Kids Kickboxing');
  });

  it('does not treat missed or cancelled visits as arrived today', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    const missed = makeCheckIn({
      id: 'missed',
      checked_in_at: '2026-07-22T08:00:00.000Z',
      missed: true,
    });
    const cancelled = makeCheckIn({
      id: 'cancel',
      checked_in_at: '2026-07-22T08:30:00.000Z',
      late_cancelled: true,
    });
    const good = makeCheckIn({
      id: 'good',
      checked_in_at: '2026-07-22T09:00:00.000Z',
      method: 'gate_scan',
    });

    expect(isArrivedTodayCheckIn(missed, now)).toBe(false);
    expect(isArrivedTodayCheckIn(cancelled, now)).toBe(false);
    expect(findTodaysArrival([missed, cancelled, good], now)?.id).toBe('good');
  });

  it('picks the latest arrival today for the card clock', () => {
    const now = new Date('2026-07-22T18:00:00.000Z');
    const first = makeCheckIn({
      id: 'first',
      checked_in_at: '2026-07-22T08:00:00.000Z',
      method: 'gate_scan',
    });
    const second = makeCheckIn({
      id: 'second',
      checked_in_at: '2026-07-22T14:05:00.000Z',
      method: 'gate_scan',
    });

    expect(findTodaysArrival([first, second], now)?.id).toBe('second');
    expect(findLatestFacilityArrivalToday([second, first], now)?.id).toBe('second');
  });
});

describe('unifyClassAttendance', () => {
  it('suppresses coach_roster mirror when roll-call exists for same class', () => {
    const checkIns = [
      makeCheckIn({
        id: 'roster',
        method: 'coach_roster',
        class_id: 'class-1',
        checked_in_at: '2026-07-22T09:05:00.000Z',
        classes: { id: 'class-1', title: 'BJJ' } as CheckInRow['classes'],
      }),
      makeCheckIn({
        id: 'mb',
        method: 'mindbody_visit',
        class_id: 'class-2',
        checked_in_at: '2026-07-21T10:00:00.000Z',
        raw_payload: { ClassDescription: { Name: 'Boxing' } },
      }),
    ];
    const rollCalls = [makeRollCall({ id: '1', classId: 'class-1' })];

    const unified = unifyClassAttendance(checkIns, rollCalls);
    const ids = unified.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(['rc-1', 'ci-mb']));
    expect(ids).not.toContain('ci-roster');
    expect(unified).toHaveLength(2);
  });

  it('keeps coach_roster when no matching roll-call', () => {
    const checkIns = [
      makeCheckIn({
        id: 'solo',
        method: 'coach_roster',
        class_id: 'class-9',
        classes: { id: 'class-9', title: 'Wrestling' } as CheckInRow['classes'],
      }),
    ];
    const unified = unifyClassAttendance(checkIns, []);
    expect(unified).toHaveLength(1);
    expect(unified[0]?.id).toBe('ci-solo');
  });
});

describe('groupAttendanceByMonth', () => {
  it('inserts month headers for reverse-chronological items', () => {
    const items = [
      { id: 'a', timestamp: '2026-07-10T12:00:00.000Z' },
      { id: 'b', timestamp: '2026-07-01T12:00:00.000Z' },
      { id: 'c', timestamp: '2026-06-15T12:00:00.000Z' },
    ];
    const grouped = groupAttendanceByMonth(items);
    const kinds = grouped.map((entry) => entry.kind);
    expect(kinds.filter((k) => k === 'month')).toHaveLength(2);
    expect(grouped[0]?.kind).toBe('month');
    expect(grouped.filter((e) => e.kind === 'row')).toHaveLength(3);
  });
});

describe('formatAttendance', () => {
  it('labels methods from real channel, not class presence', () => {
    expect(formatCheckInMethod('gate_scan')).toBe('Gate');
    expect(formatCheckInMethod('coach_roster')).toBe('Coach roster');
    expect(formatCheckInMethod('mindbody_visit')).toBe('Synced');
  });

  it('keeps headline and time separate (no duplicated date in subtitle)', () => {
    const iso = '2026-01-05T12:00:00.000Z';
    const headline = formatAttendanceHeadline(iso);
    const time = formatAttendanceTime(iso);
    expect(headline).not.toMatch(/\d{1,2}:\d{2}/);
    expect(time).toMatch(/AM|PM/);
    expect(`${headline} · ${time}`).not.toContain('at');
  });
});
