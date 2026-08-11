/** Belt progression expectations after check_ins insert (on_check_in trigger). */

export type RankDiscipline = {
  slug: string;
  hasRankProgression: boolean;
  active: boolean;
};

export function disciplinesToRecomputeOnCheckIn(disciplines: RankDiscipline[]): string[] {
  return disciplines.filter((row) => row.active && row.hasRankProgression).map((row) => row.slug);
}

export function checkInTriggersBeltRecompute(params: {
  checkInInserted: boolean;
  mindbodyWriteFailed: boolean;
}): boolean {
  // Gate access and class check-in flows record attendance only after Mindbody accepts the arrival.
  if (params.mindbodyWriteFailed) return false;
  return params.checkInInserted;
}

export function beltProgressStaleWhenCheckInBlocked(params: {
  previousTrainingDays: number;
  checkInRecorded: boolean;
  expectedTrainingDays: number;
}): boolean {
  return !params.checkInRecorded && params.expectedTrainingDays > params.previousTrainingDays;
}
