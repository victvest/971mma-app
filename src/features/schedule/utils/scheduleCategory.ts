import type { ClassItem } from '@/types/domain';

/** Member-facing schedule filters — aligned with 971mma.com program nav. */
export const SCHEDULE_CATEGORIES = [
  'bjj',
  'wrestling',
  'muay-thai',
  'mma',
  'boxing',
  'fitness',
] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number];

export const SCHEDULE_CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  bjj: 'BJJ',
  wrestling: 'Wrestling',
  'muay-thai': 'Muay Thai',
  mma: 'MMA',
  boxing: 'Boxing',
  fitness: 'Fitness',
};

type CategoryRule = {
  category: ScheduleCategory;
  matches: (haystack: string) => boolean;
};

/** First match wins — order matters for overlapping keywords. */
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'fitness',
    matches: (h) =>
      /gym usage|performance fitness|personal training|\byoga\b|mobility|open gym|\bfitness\b/.test(
        h,
      ),
  },
  {
    category: 'wrestling',
    matches: (h) => /wrestling/.test(h),
  },
  {
    category: 'bjj',
    matches: (h) =>
      /\bbjj\b|brazilian jiu|jiu[\s-]?jitsu|\bgi\b|grappling|nlbjj|submission|sub\.?\s*grap/.test(
        h,
      ),
  },
  {
    category: 'boxing',
    matches: (h) => /boxing/.test(h),
  },
  {
    category: 'muay-thai',
    matches: (h) => /muay[\s-]?thai|kickboxing|kb\/muay/.test(h),
  },
  {
    category: 'mma',
    matches: (h) => /\bmma\b|mixed martial/.test(h),
  },
];

function classHaystack(title: string, discipline: string | null | undefined): string {
  return `${title} ${discipline ?? ''}`.trim().toLowerCase();
}

export function resolveScheduleCategory(
  title: string,
  discipline?: string | null,
): ScheduleCategory | null {
  const haystack = classHaystack(title, discipline);
  if (!haystack) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.matches(haystack)) return rule.category;
  }
  return null;
}

export function classMatchesScheduleCategory(
  item: Pick<ClassItem, 'title' | 'discipline'>,
  category: ScheduleCategory,
): boolean {
  return resolveScheduleCategory(item.title, item.discipline) === category;
}

export function isScheduleCategory(value: string): value is ScheduleCategory {
  return (SCHEDULE_CATEGORIES as readonly string[]).includes(value);
}

export function scheduleCategoryLabel(category: ScheduleCategory): string {
  return SCHEDULE_CATEGORY_LABELS[category];
}
