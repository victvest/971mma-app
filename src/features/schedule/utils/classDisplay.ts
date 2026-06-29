import type { ClassItem } from '@/types/domain';
import type { CoachItem } from '@/types/domain';
import { isClassLiveNow } from '@/core/time/gymTime';
import {
  resolveScheduleCategory,
  scheduleCategoryLabel,
} from '@/features/schedule/utils/scheduleCategory';

export function formatDisciplineLabel(item: ClassItem): string {
  const category = resolveScheduleCategory(item.title, item.discipline);
  const discipline = category
    ? scheduleCategoryLabel(category).toUpperCase()
    : item.discipline.trim().toUpperCase();
  const level = item.level.trim();
  if (!level || level.toLowerCase() === 'all levels') {
    return discipline;
  }
  return `${discipline} ${level.toUpperCase()}`;
}

export function plainClassDescription(value: string | null): string | null {
  if (!value) return null;
  const stripped = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || null;
}

export function spotsLabel(item: ClassItem): string {
  return item.capacity > 0 ? `${item.bookedCount}/${item.capacity}` : `${item.bookedCount}`;
}

export function findCoachIdForClass(
  coaches: CoachItem[],
  classItem: Pick<ClassItem, 'coachId' | 'coachName' | 'staffMindbodyId'>,
): string | null {
  if (classItem.coachId) return classItem.coachId;

  if (classItem.staffMindbodyId) {
    const byStaff = coaches.find((coach) => coach.mindbodyStaffId === classItem.staffMindbodyId);
    if (byStaff) return byStaff.id;
  }
  const normalized = classItem.coachName.trim().toLowerCase();
  const byName = coaches.find((coach) => coach.name.trim().toLowerCase() === normalized);
  return byName?.id ?? null;
}

export type ClassStatusTone = 'live' | 'success' | 'muted' | 'error';

export function classStatusMeta(item: ClassItem): {
  label: string;
  detail: string;
  tone: ClassStatusTone;
} {
  if (item.isCancelled) {
    return {
      label: 'Cancelled',
      detail: 'This class was cancelled.',
      tone: 'error',
    };
  }

  if (isClassLiveNow(item.startsAt, item.durationMinutes)) {
    return {
      label: 'Live now',
      detail: 'Class is in session — drop in if spots are available.',
      tone: 'live',
    };
  }

  if (!item.isAvailable) {
    return {
      label: 'Class full',
      detail: 'No drop-in spots available right now.',
      tone: 'muted',
    };
  }
  return {
    label: 'Drop-in welcome',
    detail: 'No booking needed — arrive and scan your QR pass at gym entry.',
    tone: 'success',
  };
}

export function classDetailAccentLine(item: ClassItem): string {
  const meta = classStatusMeta(item);
  if (meta.tone === 'live') return 'Live now.';
  if (meta.tone === 'error') return 'Cancelled.';
  if (meta.tone === 'muted') return 'Class full.';
  return 'Drop in.';
}
