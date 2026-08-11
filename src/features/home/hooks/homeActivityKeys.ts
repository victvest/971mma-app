export const disciplineKey = (userId: string) => ['discipline-score', userId] as const;
export const memberPercentileKey = (userId: string) =>
  ['member-percentile-rank', userId] as const;
export const weekActivityKey = (userId: string) => ['week-activity', userId] as const;
export const gym8WeeksActivityKey = (userId: string) => ['gym-8weeks-activity', userId] as const;
