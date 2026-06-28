import { isGymToday, isClassEarly, isClassUpcoming } from '@/core/time/gymTime';
import type { RollCallSessionView } from '@/features/coach/roll-call/types';
import { isRollCallSessionCompleted, isRollCallSessionInProgress } from '@/features/coach/roll-call/utils/rollCallSession';

/** Attendance edits allowed through end of the class gym day (Asia/Dubai). */
export function canCorrectRollCallOnGymDay(classStartsAt: string, now = new Date()): boolean {
  return isGymToday(classStartsAt, now);
}

export function canEditRollCallSummary(
  session: RollCallSessionView | null | undefined,
  classStartsAt: string,
  now = new Date(),
): boolean {
  if (!session) return false;
  if (!canCorrectRollCallOnGymDay(classStartsAt, now)) return false;
  return isRollCallSessionInProgress(session) || isRollCallSessionCompleted(session);
}

/** Left early is meaningful once class has started (not L8 early window). */
export function canMarkLeftEarly(classStartsAt: string, now = new Date()): boolean {
  if (isClassUpcoming(classStartsAt, now)) return false;
  if (isClassEarly(classStartsAt, 15, now)) return false;
  return canCorrectRollCallOnGymDay(classStartsAt, now);
}

export function formatRollCallCompletedBanner(presentCount: number): string {
  return `Roll call completed · ${presentCount} present`;
}
