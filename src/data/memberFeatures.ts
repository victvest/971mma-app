export type TrainingSession = {
  id: string;
  checkedInAt: string;
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

/** Milestone chip shape for Know Your History (v3). */
export type JourneyMilestone = {
  id: string;
  label: string;
  value: string;
  tone: 'green' | 'red' | 'gold' | 'ink';
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
  { id: 's1', checkedInAt: hoursAgo(2), date: '', className: 'BJJ Fundamentals', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's2', checkedInAt: daysAgo(1, 19, 10), date: '', className: 'Muay Thai Striking', discipline: 'Muay Thai', coach: 'Coach Rilion', durationMin: 60, pointsEarned: 80 },
  { id: 's3', checkedInAt: daysAgo(2, 7, 5), date: '', className: 'No-Gi Grappling', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's4', checkedInAt: daysAgo(3, 20, 35), date: '', className: 'MMA Conditioning', discipline: 'Conditioning', coach: 'Coach Maeda', durationMin: 45, pointsEarned: 60 },
  { id: 's5', checkedInAt: daysAgo(4, 18, 0), date: '', className: 'BJJ Fundamentals', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's6', checkedInAt: daysAgo(6, 19, 15), date: '', className: 'Open Mat', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 90, pointsEarned: 100 },
  { id: 's7', checkedInAt: daysAgo(8, 18, 30), date: '', className: 'Muay Thai Clinch', discipline: 'Muay Thai', coach: 'Coach Rilion', durationMin: 60, pointsEarned: 80 },
  { id: 's8', checkedInAt: daysAgo(12, 7, 0), date: '', className: 'Morning MMA', discipline: 'MMA', coach: 'Coach Maeda', durationMin: 60, pointsEarned: 80 },
  { id: 's9', checkedInAt: daysAgo(18, 20, 10), date: '', className: 'BJJ Drilling', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
  { id: 's10', checkedInAt: daysAgo(25, 18, 45), date: '', className: 'Strength & Mobility', discipline: 'Conditioning', coach: 'Coach Maeda', durationMin: 45, pointsEarned: 60 },
  { id: 's11', checkedInAt: daysAgo(32, 19, 0), date: '', className: 'Muay Thai Fundamentals', discipline: 'Muay Thai', coach: 'Coach Rilion', durationMin: 60, pointsEarned: 80 },
  { id: 's12', checkedInAt: daysAgo(40, 18, 15), date: '', className: 'BJJ Fundamentals', discipline: 'BJJ', coach: 'Coach Tony', durationMin: 60, pointsEarned: 80 },
].map((s) => ({ ...s, date: formatMockDate(s.checkedInAt) }));

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function daysAgo(d: number, hour = 18, min = 0) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, min, 0, 0);
  return t.toISOString();
}

function formatMockDate(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} · ${time}`;
}

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
