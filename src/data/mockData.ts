import { ImageSourcePropType } from 'react-native';

export type Discipline = 'BJJ' | 'Muay Thai' | 'MMA' | 'Boxing' | 'Wrestling' | 'Conditioning';

export type GymClass = {
  id: string;
  title: string;
  discipline: Discipline;
  coach: string;
  startTime: string; // "18:00"
  endTime: string; // "19:00"
  day: string; // "Today" | "Mon" ...
  durationMin: number;
  level: 'All levels' | 'Beginner' | 'Intermediate' | 'Advanced';
  capacity: number;
  booked: number;
  image: ImageSourcePropType;
  accent: 'green' | 'red' | 'ink';
  startsAt?: string;
  isBooked?: boolean;
};

export const heroImage = require('../../assets/images/hero-bjj.jpg');
export const facilityImage = require('../../assets/images/facility.jpg');
export const communityImage = require('../../assets/images/community.jpg');

const bjjImg = require('../../assets/images/class-bjj.jpg');
const boxingImg = require('../../assets/images/class-boxing.jpg');
const conditioningImg = require('../../assets/images/class-conditioning.jpg');

export const todayClasses: GymClass[] = [
  {
    id: 'c-1',
    title: 'BJJ Fundamentals',
    discipline: 'BJJ',
    coach: 'Coach Tony',
    startTime: '18:00',
    endTime: '19:00',
    day: 'Today',
    durationMin: 60,
    level: 'All levels',
    capacity: 24,
    booked: 19,
    image: bjjImg,
    accent: 'green',
  },
  {
    id: 'c-2',
    title: 'Muay Thai Striking',
    discipline: 'Muay Thai',
    coach: 'Coach Rilion',
    startTime: '19:15',
    endTime: '20:15',
    day: 'Today',
    durationMin: 60,
    level: 'Intermediate',
    capacity: 20,
    booked: 20,
    image: boxingImg,
    accent: 'red',
  },
  {
    id: 'c-3',
    title: 'MMA Conditioning',
    discipline: 'Conditioning',
    coach: 'Coach Maeda',
    startTime: '20:30',
    endTime: '21:15',
    day: 'Today',
    durationMin: 45,
    level: 'All levels',
    capacity: 18,
    booked: 11,
    image: conditioningImg,
    accent: 'ink',
  },
];

export const weekClasses: GymClass[] = [
  ...todayClasses,
  {
    id: 'c-4',
    title: 'No-Gi Grappling',
    discipline: 'BJJ',
    coach: 'Coach Tony',
    startTime: '07:00',
    endTime: '08:00',
    day: 'Tomorrow',
    durationMin: 60,
    level: 'Advanced',
    capacity: 16,
    booked: 9,
    image: bjjImg,
    accent: 'ink',
  },
  {
    id: 'c-5',
    title: 'Boxing Foundations',
    discipline: 'Boxing',
    coach: 'Coach Rilion',
    startTime: '18:00',
    endTime: '19:00',
    day: 'Tomorrow',
    durationMin: 60,
    level: 'Beginner',
    capacity: 22,
    booked: 6,
    image: boxingImg,
    accent: 'red',
  },
  {
    id: 'c-6',
    title: 'Wrestling for MMA',
    discipline: 'Wrestling',
    coach: 'Coach Maeda',
    startTime: '19:30',
    endTime: '20:30',
    day: 'Tomorrow',
    durationMin: 60,
    level: 'Intermediate',
    capacity: 18,
    booked: 14,
    image: conditioningImg,
    accent: 'green',
  },
];

export const disciplines: { label: string; value: Discipline | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'BJJ', value: 'BJJ' },
  { label: 'Muay Thai', value: 'Muay Thai' },
  { label: 'MMA', value: 'MMA' },
  { label: 'Boxing', value: 'Boxing' },
  { label: 'Wrestling', value: 'Wrestling' },
];

export const membership = {
  plan: 'Unlimited Elite',
  status: 'Active' as 'Active' | 'Paused' | 'Expired',
  memberSince: 'Apr 2024',
  renewsOn: 'Jul 12, 2026',
  memberId: '971-0042',
  checkInsThisMonth: 14,
  monthlyGoal: 20,
  streakDays: 6,
};

export const progress = {
  track: 'Brazilian Jiu Jitsu',
  rank: 'White Belt',
  stripes: 2,
  nextRank: 'White Belt · Stripe 3',
  percent: 68,
  requirements: [
    { id: 'r1', label: 'Attendance · 12 classes', done: true },
    { id: 'r2', label: 'Escape fundamentals', done: true },
    { id: 'r3', label: 'Guard retention review', done: false },
    { id: 'r4', label: 'Assessment round', done: false },
  ],
};

export const stats = [
  { label: 'Check-ins', value: '14', sub: 'this month' },
  { label: 'Day streak', value: '6', sub: 'keep it up' },
  { label: 'Discipline', value: '86', sub: 'score' },
];

export const recentActivity = [
  { id: 'a1', title: 'Checked in', detail: 'BJJ Fundamentals · Coach Tony', time: '2h ago', accent: 'green' as const },
  { id: 'a2', title: 'Streak bonus', detail: '6-day attendance streak unlocked', time: '2h ago', accent: 'red' as const },
  { id: 'a3', title: 'Session logged', detail: 'Muay Thai Striking · Coach Rilion', time: 'Yesterday', accent: 'green' as const },
  { id: 'a4', title: 'Stripe progress', detail: 'Guard retention reviewed by coach', time: 'Yesterday', accent: 'red' as const },
  { id: 'a5', title: 'Points earned', detail: '+80 pts · No-Gi Grappling', time: 'Wed', accent: 'gold' as const },
];

export const coaches = [
  { id: 'co1', name: 'Coach Tony', role: 'Head BJJ Coach', tag: 'BJJ' },
  { id: 'co2', name: 'Coach Rilion', role: 'Striking Coach', tag: 'Muay Thai' },
  { id: 'co3', name: 'Coach Maeda', role: 'Performance Coach', tag: 'Strength' },
];

export const coachProfiles = [
  {
    id: 'co1',
    name: 'Coach Tony',
    role: 'HEAD COACH',
    belt: 'Black belt · 5th degree',
    rating: 4.9,
    image: heroImage,
    about:
      'Head BJJ coach at 971 MMA. Trained under Rilion Gracie lineage. Focus on fundamentals, competition prep, and building disciplined athletes on the mat.',
    disciplines: ['BJJ GI', 'BJJ NOGI', 'MMA'] as const,
    lineage: 'Lineage · Rilion Gracie',
  },
  {
    id: 'co2',
    name: 'Coach Rilion',
    role: 'STRIKING COACH',
    belt: 'Muay Thai · Kru',
    rating: 4.8,
    image: boxingImg,
    about: 'Striking specialist — Muay Thai, boxing, and MMA stand-up for all levels.',
    disciplines: ['MUAY THAI', 'BOXING'] as const,
    lineage: 'Lineage · Thailand camp circuit',
  },
  {
    id: 'co3',
    name: 'Coach Maeda',
    role: 'PERFORMANCE COACH',
    belt: 'Strength & conditioning',
    rating: 4.9,
    image: conditioningImg,
    about: 'Builds fight-ready engines — mobility, power, and recovery for 971 athletes.',
    disciplines: ['CONDITIONING', 'MMA'] as const,
    lineage: 'Lineage · Performance lab',
  },
];

export type WeekDayStatus = 'accent' | 'done' | 'pending';

export const weekActivity = {
  sessionCount: 5,
  /** Mon–Sun: accent = brand green, done = ink black, pending = open day */
  days: ['accent', 'done', 'done', 'pending', 'done', 'pending', 'pending'] as const satisfies readonly WeekDayStatus[],
};

export const lineage = {
  chain: ['MAEDA', 'GRACIE', 'TONY'] as const,
  caption: 'Brazilian Jiu-Jitsu roots at 971 MMA',
  image: communityImage,
};

export const disciplineScore = 86;
export const totalSessionsLogged = 147;

export const eightWeekActivity = [0.4, 0.55, 0.7, 0.6, 0.85, 0.75, 0.9, 1] as const;

export const announcement = {
  tag: 'This week',
  title: 'Open Mat Saturday',
  detail: 'All belts welcome · 11:00 AM. Bring a training partner and earn a guest pass.',
};
