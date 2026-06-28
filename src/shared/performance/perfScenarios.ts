/** Stable performance mark names used across the app and baseline docs. */
export const PerfMark = {
  appFontsReady: 'app:fonts-ready',
  authSessionRestored: 'auth:session-restored',
  authRouted: 'auth:routed',
  startupBackgroundScheduled: 'startup:background-scheduled',
  startupBackgroundComplete: 'startup:background-complete',

  routeHomeMount: 'route:home:mount',
  routeHomeFirstContent: 'route:home:first-content',
  routeScheduleMount: 'route:schedule:mount',
  routeScheduleFirstContent: 'route:schedule:first-content',
  routeCheckinMount: 'route:checkin:mount',
  routeCheckinFirstContent: 'route:checkin:first-content',
  routeCoachesMount: 'route:coaches:mount',
  routeCoachesFirstContent: 'route:coaches:first-content',
  routeProfileMount: 'route:profile:mount',
  routeProfileFirstContent: 'route:profile:first-content',
  routeCoachHomeMount: 'route:coach-home:mount',
  routeCoachHomeFirstContent: 'route:coach-home:first-content',
  routeRollCallMount: 'route:roll-call:mount',
  routeGateMount: 'route:gate:mount',

  queryFirstSuccess: 'query:first-success',
  qrTokenVisible: 'qr:token-visible',
  scannerActive: 'scanner:active',
  rollCallFirstCardInteractive: 'roll-call:first-card-interactive',
  gateQrVisible: 'gate:qr-visible',
} as const;

export type PerfMarkName = (typeof PerfMark)[keyof typeof PerfMark];

/** User journeys exercised when capturing a performance baseline. */
export const PERF_SCENARIOS = [
  {
    id: 'cold-launch-home',
    label: 'Cold launch to Home first content',
    marks: [PerfMark.appFontsReady, PerfMark.authSessionRestored, PerfMark.routeHomeMount, PerfMark.routeHomeFirstContent],
  },
  {
    id: 'auth-restore-route',
    label: 'Auth restore to routed screen',
    marks: [PerfMark.authSessionRestored, PerfMark.authRouted],
  },
  {
    id: 'home-idle-network',
    label: 'Home tab idle network count',
    marks: [PerfMark.routeHomeFirstContent, PerfMark.queryFirstSuccess],
  },
  {
    id: 'tab-schedule',
    label: 'Tab switch to Schedule',
    marks: [PerfMark.routeScheduleMount, PerfMark.routeScheduleFirstContent],
  },
  {
    id: 'tab-checkin',
    label: 'Tab switch to Check-in',
    marks: [PerfMark.routeCheckinMount, PerfMark.routeCheckinFirstContent],
  },
  {
    id: 'qr-pass-visible',
    label: 'QR pass token visible',
    marks: [PerfMark.qrTokenVisible],
  },
  {
    id: 'scanner-active',
    label: 'Scanner camera active',
    marks: [PerfMark.scannerActive],
  },
  {
    id: 'schedule-scroll',
    label: 'Schedule scroll',
    marks: [PerfMark.routeScheduleFirstContent],
  },
  {
    id: 'coaches-scroll',
    label: 'Coaches grid scroll',
    marks: [PerfMark.routeCoachesFirstContent],
  },
  {
    id: 'profile-scroll',
    label: 'Profile scroll',
    marks: [PerfMark.routeProfileFirstContent],
  },
  {
    id: 'roll-call-swipe',
    label: 'Roll-call swipe sequence',
    marks: [PerfMark.routeRollCallMount, PerfMark.rollCallFirstCardInteractive],
  },
  {
    id: 'coach-scanner-mark',
    label: 'Coach scanner scan-to-mark',
    marks: [PerfMark.scannerActive],
  },
  {
    id: 'gate-qr-refresh',
    label: 'Gate QR refresh',
    marks: [PerfMark.routeGateMount, PerfMark.gateQrVisible],
  },
] as const;
