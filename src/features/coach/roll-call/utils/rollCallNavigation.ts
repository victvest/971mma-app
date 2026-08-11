import { router, type Href } from 'expo-router';
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

function rollCallScannerPath(classId: string, source?: 'run_class' | 'swiper'): string {
  const base = `/(coach)/scanner?classId=${classId}`;
  return source ? `${base}&source=${source}` : base;
}

function asHref(path: string): Href {
  return path as Href;
}

/**
 * Stack contract for coach roll call (coach stack only):
 *
 *   Home / Classes
 *     └─ navigate → Run Class Hub  (one hub per class; never push duplicates)
 *          ├─ push → Deck
 *          │    └─ replace → Summary   (deck must not sit under summary)
 *          │         └─ dismissTo Hub
 *          ├─ push → Summary           (from hub when all marked / history)
 *          │    └─ dismissTo Hub
 *          └─ push → Scanner           (from hub, deck, or summary)
 *               └─ back → opener
 *
 * Never `replace(hub)` from summary/scanner — that stacks a second hub and
 * makes Back appear stuck on the same screen.
 */

/** Open hub from home/classes — reuses an existing hub for this class when present. */
export function openRunClassHub(classId: string): void {
  router.navigate(asHref(rollCallClassHubPath(classId)));
}

/**
 * Pop nested screens until the run-class hub. Prefers dismissTo so duplicate
 * hubs / dead decks are cleared; falls back to replace only if hub is absent.
 */
export function returnToRunClassHub(classId: string): void {
  router.dismissTo(asHref(rollCallClassHubPath(classId)));
}

/** Leave the hub (and any nested roll-call screens) for coach home. */
export function exitRunClassHub(options?: { forceHome?: boolean }): void {
  if (options?.forceHome) {
    router.dismissTo(asHref(COACH_HOME_PATH));
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(asHref(COACH_HOME_PATH));
}

/** Push deck from the hub. */
export function openRollCallDeck(classId: string, options?: { review?: boolean }): void {
  router.push(asHref(rollCallDeckPath(classId, options)));
}

/** Push summary from the hub (Back returns to hub). */
export function openRollCallSummary(classId: string): void {
  router.push(asHref(rollCallSummaryPath(classId)));
}

/**
 * Hub primary CTA: deck while marking, summary when everyone is marked or
 * session is completed history.
 */
export function openRollCallPrimary(
  classId: string,
  session: RollCallSessionView | null | undefined,
  markedCount: number,
  totalOnDeck: number,
): void {
  const path = rollCallPrimaryPath(classId, session, markedCount, totalOnDeck);
  if (path === rollCallSummaryPath(classId)) {
    openRollCallSummary(classId);
    return;
  }
  openRollCallDeck(classId);
}

/** Replace the live deck with summary so Back never returns to an all-marked deck. */
export function replaceWithRollCallSummary(classId: string): void {
  router.replace(asHref(rollCallSummaryPath(classId)));
}

/** Leave deck for hub (discard / save & resume). */
export function leaveRollCallDeck(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(asHref(COACH_HOME_PATH));
}

/** Session already completed while on deck — leave the whole roll-call stack. */
export function exitCompletedRollCall(): void {
  router.dismissTo(asHref(COACH_HOME_PATH));
}

/** Push scanner on top of the current screen (hub, deck, or summary). */
export function openRollCallScanner(classId: string, source?: 'run_class' | 'swiper'): void {
  router.push(asHref(rollCallScannerPath(classId, source)));
}

/**
 * Close scanner with Back. Never replace(hub) — that duplicates the hub under
 * the previous opener and breaks the back stack.
 */
export function closeRollCallScanner(classId?: string | null): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (classId) {
    router.replace(asHref(rollCallClassHubPath(classId)));
    return;
  }
  router.replace(asHref(COACH_HOME_PATH));
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
  totalOnDeck = 0,
): string {
  if (isRollCallSessionCompleted(session)) {
    return 'Attendance history';
  }
  if (
    isRollCallSessionInProgress(session) &&
    totalOnDeck > 0 &&
    markedCount >= totalOnDeck
  ) {
    return 'View roll call summary';
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
  const totalOnDeck = summary?.totalOnDeck ?? 0;
  const totalMarked = summary?.totalMarked ?? 0;
  if (isRollCallSessionInProgress(session) && totalOnDeck > 0 && totalMarked >= totalOnDeck) {
    return 'Everyone is marked · review and confirm attendance';
  }
  if (isRollCallSessionInProgress(session) && totalMarked > 0) {
    return `${totalMarked} marked · pick up where you left off`;
  }
  return 'Swipe through faces to mark present or absent — fastest way to take attendance';
}

/** Primary CTA path from the run-class hub. */
export function rollCallPrimaryPath(
  classId: string,
  session: RollCallSessionView | null | undefined,
  markedCount: number,
  totalOnDeck: number,
): string {
  if (isRollCallSessionCompleted(session)) {
    return rollCallSummaryPath(classId);
  }
  if (
    isRollCallSessionInProgress(session) &&
    totalOnDeck > 0 &&
    markedCount >= totalOnDeck
  ) {
    return rollCallSummaryPath(classId);
  }
  return rollCallDeckPath(classId);
}
