import { gymDayKey } from '@/core/time/gymTime';
import type { ClassItem, CoachItem } from '@/types/domain';

export const DEMO_ACADEMY_CLASS_PREFIX = 'demo-academy-class-';

type AcademyCoachSlug =
  | 'rogerio-alves-luz'
  | 'joe-gerrard'
  | 'carl-booth'
  | 'wellington-pereira'
  | 'ahmad-al-bouti'
  | 'mohammadali-geraei'
  | 'leandro-castro-monteiro';

type ClassSeed = {
  coachSlug: AcademyCoachSlug;
  disciplineSlug: string;
  discipline: string;
  slotKey: string;
  dayOffset: 0 | 1;
  hour: number;
  minute: number;
  title: string;
  description: string;
  level: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
};

const ACADEMY_COACH_NAMES: Record<AcademyCoachSlug, string> = {
  'rogerio-alves-luz': 'Rogerio Alves Luz',
  'joe-gerrard': 'Joe Gerrard',
  'carl-booth': 'Carl Booth',
  'wellington-pereira': 'Wellington Pereira',
  'ahmad-al-bouti': 'Ahmad Al Bouti',
  'mohammadali-geraei': 'Mohammadali Geraei',
  'leandro-castro-monteiro': 'Leandro Castro Monteiro',
};

const CLASS_SEEDS: ClassSeed[] = [
  {
    coachSlug: 'rogerio-alves-luz',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'today-am-gi',
    dayOffset: 0,
    hour: 10,
    minute: 0,
    title: 'Gi Fundamentals',
    description:
      'Build a strong foundation in grips, posture, and core positions. Ideal for white and blue belts building consistent mat habits.',
    level: 'All Levels',
    durationMinutes: 90,
    capacity: 24,
    bookedCount: 18,
  },
  {
    coachSlug: 'rogerio-alves-luz',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'today-pm-adv',
    dayOffset: 0,
    hour: 19,
    minute: 0,
    title: 'Advanced Gi',
    description:
      'High-intensity positional sparring and competition-specific chains for purple belts and above.',
    level: 'Advanced',
    durationMinutes: 90,
    capacity: 20,
    bookedCount: 16,
  },
  {
    coachSlug: 'rogerio-alves-luz',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'tomorrow-comp',
    dayOffset: 1,
    hour: 11,
    minute: 0,
    title: 'Competition Drilling',
    description:
      'Takedown entries, guard passing sequences, and situational rounds for athletes preparing for tournaments.',
    level: 'Intermediate',
    durationMinutes: 90,
    capacity: 22,
    bookedCount: 12,
  },
  {
    coachSlug: 'joe-gerrard',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'today-kids-am',
    dayOffset: 0,
    hour: 9,
    minute: 0,
    title: 'Kids BJJ (Ages 6–8)',
    description:
      'Fun, structured introduction to jiu-jitsu with games, basic positions, and mat etiquette for young beginners.',
    level: 'Kids',
    durationMinutes: 60,
    capacity: 16,
    bookedCount: 11,
  },
  {
    coachSlug: 'joe-gerrard',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'today-kids-pm',
    dayOffset: 0,
    hour: 16,
    minute: 0,
    title: 'Kids MMA Fundamentals',
    description:
      'Safe striking pads, basic wrestling entries, and team drills that build coordination and confidence.',
    level: 'Kids',
    durationMinutes: 60,
    capacity: 16,
    bookedCount: 13,
  },
  {
    coachSlug: 'joe-gerrard',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'tomorrow-kids',
    dayOffset: 1,
    hour: 9,
    minute: 0,
    title: 'Kids BJJ (Ages 9–12)',
    description:
      'Expanded technique library with controlled sparring for developing youth athletes.',
    level: 'Kids',
    durationMinutes: 60,
    capacity: 18,
    bookedCount: 9,
  },
  {
    coachSlug: 'carl-booth',
    disciplineSlug: 'muay_thai',
    discipline: 'Muay Thai / Striking',
    slotKey: 'today-fund',
    dayOffset: 0,
    hour: 12,
    minute: 0,
    title: 'Muay Thai Fundamentals',
    description:
      'Stance, footwork, teep, and basic combinations on pads. Perfect for beginners and returning strikers.',
    level: 'All Levels',
    durationMinutes: 60,
    capacity: 22,
    bookedCount: 17,
  },
  {
    coachSlug: 'carl-booth',
    disciplineSlug: 'muay_thai',
    discipline: 'Muay Thai / Striking',
    slotKey: 'today-k1',
    dayOffset: 0,
    hour: 18,
    minute: 0,
    title: 'K1 Conditioning',
    description:
      'High-energy pad rounds, bag work, and fight-specific conditioning to sharpen your striking engine.',
    level: 'Intermediate',
    durationMinutes: 60,
    capacity: 20,
    bookedCount: 19,
  },
  {
    coachSlug: 'carl-booth',
    disciplineSlug: 'muay_thai',
    discipline: 'Muay Thai / Striking',
    slotKey: 'tomorrow-spar',
    dayOffset: 1,
    hour: 17,
    minute: 0,
    title: 'Muay Thai Sparring',
    description: 'Controlled sparring with coach supervision. Mouthguard and shin guards required.',
    level: 'Advanced',
    durationMinutes: 75,
    capacity: 16,
    bookedCount: 14,
  },
  {
    coachSlug: 'wellington-pereira',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'today-tech',
    dayOffset: 0,
    hour: 11,
    minute: 30,
    title: 'MMA Technical',
    description:
      'Integrated striking-to-grappling chains, cage awareness, and round structure for well-rounded MMA athletes.',
    level: 'Intermediate',
    durationMinutes: 90,
    capacity: 24,
    bookedCount: 20,
  },
  {
    coachSlug: 'wellington-pereira',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'today-spar',
    dayOffset: 0,
    hour: 20,
    minute: 0,
    title: 'MMA Sparring',
    description:
      'MMA-specific sparring rounds with mandatory safety equipment. Coach approval required for new athletes.',
    level: 'Advanced',
    durationMinutes: 90,
    capacity: 18,
    bookedCount: 15,
  },
  {
    coachSlug: 'wellington-pereira',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'tomorrow-wrest',
    dayOffset: 1,
    hour: 12,
    minute: 30,
    title: 'MMA Wrestling for MMA',
    description:
      'Takedown entries, cage wrestling, and mat returns tailored for mixed rules competition.',
    level: 'All Levels',
    durationMinutes: 75,
    capacity: 22,
    bookedCount: 10,
  },
  {
    coachSlug: 'ahmad-al-bouti',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'today-fund',
    dayOffset: 0,
    hour: 8,
    minute: 0,
    title: 'MMA Fundamentals',
    description:
      'Clean mechanics for striking, clinch, and ground transitions. Beginner-friendly with progressive intensity.',
    level: 'Beginner',
    durationMinutes: 75,
    capacity: 24,
    bookedCount: 14,
  },
  {
    coachSlug: 'ahmad-al-bouti',
    disciplineSlug: 'performance_fitness',
    discipline: 'Performance & Fitness',
    slotKey: 'today-fit',
    dayOffset: 0,
    hour: 17,
    minute: 30,
    title: 'Combat Athlete Conditioning',
    description:
      'Strength circuits, mobility, and energy-system work designed for fighters and general fitness members.',
    level: 'All Levels',
    durationMinutes: 60,
    capacity: 20,
    bookedCount: 16,
  },
  {
    coachSlug: 'ahmad-al-bouti',
    disciplineSlug: 'mma',
    discipline: 'Mixed Martial Arts',
    slotKey: 'tomorrow-tech',
    dayOffset: 1,
    hour: 18,
    minute: 30,
    title: 'MMA Flow Drills',
    description:
      'Partner drills linking strikes, entries, and submissions at moderate pace for skill consolidation.',
    level: 'Intermediate',
    durationMinutes: 75,
    capacity: 22,
    bookedCount: 11,
  },
  {
    coachSlug: 'mohammadali-geraei',
    disciplineSlug: 'wrestling',
    discipline: 'Wrestling',
    slotKey: 'today-fund',
    dayOffset: 0,
    hour: 7,
    minute: 30,
    title: 'Freestyle Wrestling Fundamentals',
    description: 'Stance, motion, level changes, and basic takedowns. No experience required.',
    level: 'All Levels',
    durationMinutes: 75,
    capacity: 20,
    bookedCount: 12,
  },
  {
    coachSlug: 'mohammadali-geraei',
    disciplineSlug: 'wrestling',
    discipline: 'Wrestling',
    slotKey: 'today-live',
    dayOffset: 0,
    hour: 19,
    minute: 30,
    title: 'Wrestling Live Rounds',
    description:
      'Situational wrestling and live go rounds with emphasis on mat returns and control.',
    level: 'Intermediate',
    durationMinutes: 75,
    capacity: 18,
    bookedCount: 17,
  },
  {
    coachSlug: 'mohammadali-geraei',
    disciplineSlug: 'wrestling',
    discipline: 'Wrestling',
    slotKey: 'tomorrow-clinic',
    dayOffset: 1,
    hour: 10,
    minute: 30,
    title: 'Takedown Clinic',
    description:
      'Deep dive on double-leg, single-leg, and chain wrestling for BJJ and MMA athletes.',
    level: 'All Levels',
    durationMinutes: 90,
    capacity: 22,
    bookedCount: 8,
  },
  {
    coachSlug: 'leandro-castro-monteiro',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'today-nogi',
    dayOffset: 0,
    hour: 13,
    minute: 0,
    title: 'No-Gi Fundamentals',
    description:
      'Wrestling-up connections, front headlock systems, and leg-entangle awareness for no-gi practitioners.',
    level: 'All Levels',
    durationMinutes: 90,
    capacity: 24,
    bookedCount: 19,
  },
  {
    coachSlug: 'leandro-castro-monteiro',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'today-adv',
    dayOffset: 0,
    hour: 20,
    minute: 30,
    title: 'No-Gi Advanced',
    description: 'High-level passing, back takes, and submission chains for experienced grapplers.',
    level: 'Advanced',
    durationMinutes: 90,
    capacity: 18,
    bookedCount: 16,
  },
  {
    coachSlug: 'leandro-castro-monteiro',
    disciplineSlug: 'bjj',
    discipline: 'Brazilian Jiu-Jitsu',
    slotKey: 'tomorrow-open',
    dayOffset: 1,
    hour: 10,
    minute: 0,
    title: 'Open Mat — No-Gi',
    description:
      'Open rolling with coach supervision. Drop in, work your game, and get feedback between rounds.',
    level: 'All Levels',
    durationMinutes: 120,
    capacity: 30,
    bookedCount: 12,
  },
];

function normalizeCoachName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function gymDayIso(dayOffset: 0 | 1, hour: number, minute: number, now = new Date()): string {
  const base = dayOffset === 0 ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const day = gymDayKey(base);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${day}T${hh}:${mm}:00+04:00`).toISOString();
}

function buildClassItem(seed: ClassSeed, coachId: string | null, now = new Date()): ClassItem {
  const id = `${DEMO_ACADEMY_CLASS_PREFIX}${seed.coachSlug}-${seed.slotKey}`;
  const coachName = ACADEMY_COACH_NAMES[seed.coachSlug];
  const startsAt = gymDayIso(seed.dayOffset, seed.hour, seed.minute, now);
  const isFull = seed.bookedCount >= seed.capacity;

  return {
    id,
    title: seed.title,
    discipline: seed.discipline,
    disciplineId: null,
    description: seed.description,
    coachName,
    coachId,
    startsAt,
    durationMinutes: seed.durationMinutes,
    capacity: seed.capacity,
    level: seed.level,
    imageUrl: null,
    bookedCount: seed.bookedCount,
    isAvailable: !isFull,
    isWaitlistAvailable: isFull,
    isCancelled: false,
    mindbodyClassId: `demo-seed-${seed.coachSlug}-${seed.slotKey}`,
    staffMindbodyId: null,
  };
}

export function isDemoAcademyClassId(classId: string): boolean {
  return classId.startsWith(DEMO_ACADEMY_CLASS_PREFIX);
}

export function resolveAcademyCoachSlug(coach: Pick<CoachItem, 'name'>): AcademyCoachSlug | null {
  const normalized = normalizeCoachName(coach.name);
  for (const [slug, name] of Object.entries(ACADEMY_COACH_NAMES) as [AcademyCoachSlug, string][]) {
    if (normalizeCoachName(name) === normalized) return slug;
  }
  return null;
}

export function getAcademyDemoScheduleClasses(now = new Date()): ClassItem[] {
  return CLASS_SEEDS.map((seed) => buildClassItem(seed, null, now)).sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}

export function getAcademyDemoClassesForCoach(coach: CoachItem, now = new Date()): ClassItem[] {
  const slug = resolveAcademyCoachSlug(coach);
  if (!slug) return [];

  return CLASS_SEEDS.filter((seed) => seed.coachSlug === slug)
    .map((seed) => buildClassItem(seed, coach.id, now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function getAcademyDemoClassById(classId: string, now = new Date()): ClassItem | null {
  if (!isDemoAcademyClassId(classId)) return null;

  const suffix = classId.slice(DEMO_ACADEMY_CLASS_PREFIX.length);
  const seed = CLASS_SEEDS.find((item) => `${item.coachSlug}-${item.slotKey}` === suffix);
  if (!seed) return null;

  return buildClassItem(seed, null, now);
}
