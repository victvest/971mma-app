import { PerfMark } from './perfScenarios';

/** Release-blocking thresholds for post-optimization acceptance (Phase 15). */
export type PerfAcceptanceThreshold = {
  /** Matches PERF_SCENARIOS id. */
  id: string;
  label: string;
  /** Max elapsed ms between first and last scenario mark. null = timing not gated. */
  maxSpanMs: number | null;
  /** Max TanStack Query fetches recorded by the last scenario mark. null = not gated. */
  maxQueryFetches: number | null;
  /** Max edge invocations recorded by the last scenario mark. null = not gated. */
  maxEdgeInvocations: number | null;
  /** All listed marks must be present for the scenario to count as exercised. */
  requiredMarks: readonly string[];
  /** Marks that must not appear when validating this scenario (hidden-work guard). */
  forbiddenMarks?: readonly string[];
};

/**
 * Conservative release targets after Phases 1–14.
 * Validate on iOS/Android preview or release builds — not Expo Go dev mode.
 */
export const PERF_ACCEPTANCE_THRESHOLDS: readonly PerfAcceptanceThreshold[] = [
  {
    id: 'cold-launch-home',
    label: 'Cold launch to Home first content',
    maxSpanMs: 4_000,
    maxQueryFetches: 14,
    maxEdgeInvocations: 4,
    requiredMarks: [
      PerfMark.appFontsReady,
      PerfMark.routeHomeMount,
      PerfMark.routeHomeFirstContent,
    ],
    forbiddenMarks: [
      PerfMark.routeCheckinMount,
      PerfMark.qrTokenVisible,
      PerfMark.scannerActive,
    ],
  },
  {
    id: 'home-idle-network',
    label: 'Home idle — no hidden tab work',
    maxSpanMs: null,
    maxQueryFetches: 16,
    maxEdgeInvocations: 4,
    requiredMarks: [PerfMark.routeHomeFirstContent],
    forbiddenMarks: [
      PerfMark.routeCheckinMount,
      PerfMark.qrTokenVisible,
      PerfMark.scannerActive,
    ],
  },
  {
    id: 'tab-schedule',
    label: 'Tab switch to Schedule',
    maxSpanMs: 900,
    maxQueryFetches: 18,
    maxEdgeInvocations: 4,
    requiredMarks: [PerfMark.routeScheduleMount, PerfMark.routeScheduleFirstContent],
  },
  {
    id: 'tab-checkin',
    label: 'Tab switch to Check-in',
    maxSpanMs: 1_200,
    maxQueryFetches: 22,
    maxEdgeInvocations: 5,
    requiredMarks: [PerfMark.routeCheckinMount, PerfMark.routeCheckinFirstContent],
  },
  {
    id: 'qr-pass-visible',
    label: 'QR pass token visible',
    maxSpanMs: 1_800,
    maxQueryFetches: 23,
    maxEdgeInvocations: 6,
    requiredMarks: [PerfMark.qrTokenVisible],
  },
  {
    id: 'roll-call-swipe',
    label: 'Roll-call deck interactive',
    maxSpanMs: 1_500,
    maxQueryFetches: 28,
    maxEdgeInvocations: 8,
    requiredMarks: [PerfMark.routeRollCallMount, PerfMark.rollCallFirstCardInteractive],
  },
  {
    id: 'coach-scanner-mark',
    label: 'Coach scanner camera active',
    maxSpanMs: 1_200,
    maxQueryFetches: 30,
    maxEdgeInvocations: 8,
    requiredMarks: [PerfMark.scannerActive],
  },
  {
    id: 'gate-qr-refresh',
    label: 'Gate display QR visible',
    maxSpanMs: 2_500,
    maxQueryFetches: 4,
    maxEdgeInvocations: 2,
    requiredMarks: [PerfMark.routeGateMount, PerfMark.gateQrVisible],
  },
] as const;

export const PERF_ACCEPTANCE_SCENARIO_IDS = PERF_ACCEPTANCE_THRESHOLDS.map(
  (entry) => entry.id,
);
