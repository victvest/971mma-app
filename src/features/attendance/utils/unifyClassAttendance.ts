import { isClassLinkedCheckIn, isClassRosterMethod } from '@/features/attendance/utils/classifyCheckIn';
import type { CheckInRow } from '@/types/database';
import type { ClassSessionAttendanceRow } from '@/services/database/classAttendance.repository';

export type UnifiedClassAttendanceItem =
  | {
      type: 'check_in';
      id: string;
      timestamp: string;
      classId: string | null;
      rawItem: CheckInRow;
    }
  | {
      type: 'roll_call';
      id: string;
      timestamp: string;
      classId: string | null;
      rawItem: ClassSessionAttendanceRow;
    };

/**
 * Merge Mindbody/class check-ins with roll-call marks into one chronological list.
 *
 * Dedup rule: when a roll-call row exists for a class, suppress the mirrored
 * `coach_roster` check_ins row for that same class (same session, double UI).
 * Mindbody-synced class visits without a matching roll-call stay visible.
 */
export function unifyClassAttendance(
  checkIns: CheckInRow[],
  rollCalls: ClassSessionAttendanceRow[],
): UnifiedClassAttendanceItem[] {
  const rollCallClassIds = new Set(
    rollCalls.map((row) => row.classId).filter((id): id is string => Boolean(id)),
  );

  const classCheckIns: UnifiedClassAttendanceItem[] = checkIns
    .filter(isClassLinkedCheckIn)
    .filter((item) => {
      if (!item.class_id) return true;
      if (!rollCallClassIds.has(item.class_id)) return true;
      // Prefer roll-call status row over the facility mirror created on mark.
      return !isClassRosterMethod(item.method);
    })
    .map((item) => ({
      type: 'check_in' as const,
      id: `ci-${item.id}`,
      timestamp: item.checked_in_at,
      classId: item.class_id,
      rawItem: item,
    }));

  const rollCallItems: UnifiedClassAttendanceItem[] = rollCalls.map((item) => ({
    type: 'roll_call' as const,
    id: `rc-${item.id}`,
    timestamp: item.classStartsAt || item.markedAt,
    classId: item.classId,
    rawItem: item,
  }));

  return [...classCheckIns, ...rollCallItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
