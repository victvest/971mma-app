import {
  beltProgressStaleWhenCheckInBlocked,
  checkInTriggersBeltRecompute,
  disciplinesToRecomputeOnCheckIn,
} from '@/shared/belt/beltProgressionPolicy';

describe('belt progression integration policy', () => {
  it('recomputes only active rank-track disciplines on check-in', () => {
    expect(
      disciplinesToRecomputeOnCheckIn([
        { slug: 'bjj', hasRankProgression: true, active: true },
        { slug: 'boxing', hasRankProgression: false, active: true },
        { slug: 'muay-thai', hasRankProgression: true, active: false },
      ]),
    ).toEqual(['bjj']);
  });

  it('does not fire belt recompute when check-in insert is blocked', () => {
    expect(
      checkInTriggersBeltRecompute({
        checkInInserted: false,
        mindbodyWriteFailed: true,
      }),
    ).toBe(false);

    expect(
      checkInTriggersBeltRecompute({
        checkInInserted: true,
        mindbodyWriteFailed: false,
      }),
    ).toBe(true);
  });

  it('detects stale belt progress when attendance write fails', () => {
    expect(
      beltProgressStaleWhenCheckInBlocked({
        previousTrainingDays: 10,
        checkInRecorded: false,
        expectedTrainingDays: 11,
      }),
    ).toBe(true);

    expect(
      beltProgressStaleWhenCheckInBlocked({
        previousTrainingDays: 10,
        checkInRecorded: true,
        expectedTrainingDays: 11,
      }),
    ).toBe(false);
  });
});
