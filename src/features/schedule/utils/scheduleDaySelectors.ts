import {
  classMatchesScheduleCategory,
  resolveScheduleCategory,
  SCHEDULE_CATEGORIES,
  type ScheduleCategory,
} from '@/features/schedule/utils/scheduleCategory';
import { classBelongsToCoach } from '@/features/coach/utils/findCoachForProfile';
import type { ClassItem, CoachItem } from '@/types/domain';

export function filterScheduleByCategory(
  items: ClassItem[],
  category: ScheduleCategory | null,
): ClassItem[] {
  if (!category) return items;
  return items.filter((item) => classMatchesScheduleCategory(item, category));
}

export function selectScheduleCategories(items: ClassItem[]): ScheduleCategory[] {
  const present = new Set<ScheduleCategory>();

  for (const item of items) {
    const resolved = resolveScheduleCategory(item.title, item.discipline);
    if (resolved) present.add(resolved);
  }

  return SCHEDULE_CATEGORIES.filter((category) => present.has(category));
}

export function selectSchedulePage(
  items: ClassItem[],
  category: ScheduleCategory | null,
  limit: number,
  offset: number,
): ClassItem[] {
  return filterScheduleByCategory(items, category).slice(offset, offset + limit);
}

export function selectClassesByCoach(items: ClassItem[], coach: CoachItem): ClassItem[] {
  return items.filter((item) => classBelongsToCoach(item, coach));
}
