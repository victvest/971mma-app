export type TrainingSession = {
  id: string;
  date: string;
  className: string;
  discipline: string;
  coach: string;
  durationMin: number;
  pointsEarned: number;
};

export type RewardItem = {
  id: string;
  title: string;
  description: string;
  cost: number;
  icon: 'gift' | 'shirt' | 'ticket' | 'coffee';
  available: boolean;
};

export type RewardEvent = {
  id: string;
  title: string;
  points: number;
  when: string;
};

export type BeltRequirement = {
  id: string;
  label: string;
  done: boolean;
  coachSigned?: boolean;
};

export type PromotionEvent = {
  id: string;
  rank: string;
  date: string;
  coach: string;
  note?: string;
};

export const trainingStats = {
  sessionsThisMonth: 14,
  monthlyGoal: 20,
  streakDays: 6,
  hoursThisMonth: 16.5,
  disciplineScore: 86,
  lastCheckIn: '2 hours ago',
};

export const trainingSessions: TrainingSession[] = [
  { id: 's1', date: 'Today · 18:02', className: 'BJJ Fundamentals', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's2', date: 'Yesterday · 19:10', className: 'Muay Thai Striking', discipline: 'Muay Thai', coach: 'Coach Rilion', durationMin: 60, pointsEarned: 80 },
  { id: 's3', date: 'Wed · 07:05', className: 'No-Gi Grappling', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's4', date: 'Tue · 20:35', className: 'MMA Conditioning', discipline: 'Conditioning', coach: 'Coach Maeda', durationMin: 45, pointsEarned: 60 },
  { id: 's5', date: 'Mon · 18:00', className: 'BJJ Fundamentals', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
];

export const rewardsProfile = {
  points: 1240,
  lifetimePoints: 4820,
  tier: 'Gold',
  nextTier: 'Platinum',
  pointsToNext: 260,
  memberSince: 'Apr 2024',
};

export const rewardCatalog: RewardItem[] = [
  { id: 'rw1', title: 'Guest pass', description: 'Bring a friend for one open mat or fundamentals class.', cost: 400, icon: 'ticket', available: true },
  { id: 'rw2', title: '971 tee', description: 'Academy training tee — pick your size at front desk.', cost: 900, icon: 'shirt', available: true },
  { id: 'rw3', title: 'Recovery shake', description: 'Post-training shake at the bar.', cost: 150, icon: 'coffee', available: true },
  { id: 'rw4', title: 'Private review', description: '30-min technique review with a coach.', cost: 2000, icon: 'gift', available: false },
];

export const recentRewardEvents: RewardEvent[] = [
  { id: 'e1', title: 'Session check-in', points: 80, when: 'Today' },
  { id: 'e2', title: '6-day streak bonus', points: 120, when: 'Today' },
  { id: 'e3', title: 'Session check-in', points: 80, when: 'Yesterday' },
  { id: 'e4', title: 'Open mat attendance', points: 100, when: 'Sat' },
];

export const beltJourney = {
  track: 'Brazilian Jiu Jitsu',
  rank: 'White Belt',
  stripes: 2,
  nextMilestone: 'White Belt · Stripe 3',
  percent: 68,
  coachAssessment: {
    status: 'scheduled' as const,
    date: 'Thu, Jun 19 · 19:30',
    coach: 'Coach Tony',
    location: 'Mat 2',
  },
  coachNote: 'Strong guard retention progress. Assessment round scheduled — final stripe decision is made by your coach after the review.',
  requirements: [
    { id: 'r1', label: '12 classes attended on current rank', done: true, coachSigned: true },
    { id: 'r2', label: 'Escape fundamentals demonstrated', done: true, coachSigned: true },
    { id: 'r3', label: 'Guard retention review', done: false, coachSigned: false },
    { id: 'r4', label: 'Coach assessment round', done: false, coachSigned: false },
  ] as BeltRequirement[],
  history: [
    { id: 'h1', rank: 'White Belt · Stripe 2', date: 'May 3, 2026', coach: 'Coach Tony', note: 'Consistent attendance and improved top control.' },
    { id: 'h2', rank: 'White Belt · Stripe 1', date: 'Mar 8, 2026', coach: 'Coach Tony' },
    { id: 'h3', rank: 'White Belt', date: 'Apr 12, 2024', coach: 'Coach Tony', note: 'Joined 971 MMA.' },
  ] as PromotionEvent[],
};
