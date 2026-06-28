import type { RollCallSummary, RollCallSessionView } from '@/features/coach/roll-call/types';
import {
  isRollCallSessionCompleted,
  isRollCallSessionInProgress,
} from '@/features/coach/roll-call/utils/rollCallSession';

/** Coach home tab — safe exit from roll call flows. */
export const COACH_HOME_PATH = '/(coach)/(main)/';

/** Run class hub — class meta, roll call entry, scan, attendance history. */
export function rollCallClassHubPath(classId: string): string {
  return `/(coach)/run-class/${classId}`;
}

/** Active roll call deck. Pass `review` when returning from summary to edit marks. */
export function rollCallDeckPath(classId: string, options?: { review?: boolean }): string {
  const base = `/(coach)/roll-call/${classId}`;
  return options?.review ? `${base}?review=1` : base;
}

/** Post–roll call attendance review. */
export function rollCallSummaryPath(classId: string): string {
  return `/(coach)/roll-call/summary/${classId}`;
}

/** Primary entry from home / hero: hub when done, deck while in progress. */
export function rollCallEntryPath(
  classId: string,
  session: RollCallSessionView | null | undefined,
): string {
  if (isRollCallSessionCompleted(session)) {
    return rollCallClassHubPath(classId);
  }
  return rollCallDeckPath(classId);
}

export type CoachHeroAttendanceStats = {
  presentCount: number;
  missingCount: number;
  usesRollCall: boolean;
};

/** Prefer `class_session_attendance` summary once a roll call session exists. */
export function coachHeroAttendanceStats(
  summary: RollCallSummary | undefined,
  session: RollCallSessionView | null | undefined,
  rosterFallback: { checkedIn: number; missing: number },
): CoachHeroAttendanceStats {
  if (isRollCallSessionInProgress(session) || isRollCallSessionCompleted(session)) {
    const unmarked = Math.max(0, (summary?.totalOnDeck ?? 0) - (summary?.totalMarked ?? 0));
    return {
      presentCount: summary?.sessionCount ?? 0,
      missingCount: (summary?.absent ?? 0) + unmarked,
      usesRollCall: true,
    };
  }

  return {
    presentCount: rosterFallback.checkedIn,
    missingCount: rosterFallback.missing,
    usesRollCall: false,
  };
}

export function rollCallPrimaryLabel(
  session: RollCallSessionView | null | undefined,
  markedCount: number,
): string {
  if (isRollCallSessionCompleted(session)) {
    return 'Attendance history';
  }
  if (isRollCallSessionInProgress(session) && markedCount > 0) {
    return 'Resume roll call';
  }
  return 'Start roll call';
}

export function rollCallPrimaryHint(
  session: RollCallSessionView | null | undefined,
  summary: RollCallSummary | undefined,
): string {
  if (isRollCallSessionCompleted(session)) {
    const marked = summary?.totalMarked ?? 0;
    return `${marked} marked · roll call complete`;
  }
  if (isRollCallSessionInProgress(session) && (summary?.totalMarked ?? 0) > 0) {
    return `${summary?.totalMarked ?? 0} marked · pick up where you left off`;
  }
  return 'Swipe through faces to mark present or absent — fastest way to take attendance';
}
