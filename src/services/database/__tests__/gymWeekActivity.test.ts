import { GYM_TIME_ZONE } from '@/core/time/gymTime';

/**
 * Mirror of gym-day helpers used by discipline week activity.
 * Kept local to the test so we don't export private repo helpers.
 */
function gymDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(date);
}

function gymDayNoon(offsetDays: number, now: Date): Date {
  const todayKey = gymDateKey(now);
  const noon = new Date(`${todayKey}T12:00:00+04:00`);
  noon.setTime(noon.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return noon;
}

describe('gym week activity day keys', () => {
  it('builds 7 consecutive gym-local days independent of device local offset math', () => {
    // A fixed instant: 2026-07-22 01:30 UTC = 05:30 Dubai (same gym day)
    const now = new Date('2026-07-22T01:30:00.000Z');
    const keys = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      keys.push(gymDateKey(gymDayNoon(-offset, now)));
    }
    expect(keys).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
    ]);
  });
});
