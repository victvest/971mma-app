import type { ClassItem, CoachItem } from '@/types/domain';

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findCoachForProfile(
  coaches: CoachItem[],
  fullName: string | null | undefined,
): CoachItem | null {
  if (!fullName?.trim()) return null;

  const normalized = normalizeName(fullName);
  const exact = coaches.find((coach) => normalizeName(coach.name) === normalized);
  if (exact) return exact;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const partial = coaches.find((coach) => {
      const coachName = normalizeName(coach.name);
      return parts.every((part) => coachName.includes(part));
    });
    if (partial) return partial;
  }

  return null;
}

export function classBelongsToCoach(
  classItem: Pick<ClassItem, 'coachName' | 'staffMindbodyId'>,
  coach: CoachItem | null,
): boolean {
  if (!coach) return false;

  if (classItem.staffMindbodyId && coach.mindbodyStaffId) {
    return classItem.staffMindbodyId === coach.mindbodyStaffId;
  }

  return normalizeName(classItem.coachName) === normalizeName(coach.name);
}

export function collectCoachDisciplines(
  coach: CoachItem | null,
  classes: ClassItem[],
  tagDisciplines: string[],
): string[] {
  const values = new Set<string>(tagDisciplines);

  for (const classItem of classes) {
    if (!classBelongsToCoach(classItem, coach)) continue;
    const discipline = classItem.discipline.trim();
    if (discipline) values.add(discipline.toUpperCase());
  }

  return Array.from(values).slice(0, 6);
}
