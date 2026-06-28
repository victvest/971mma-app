/** Default warm cache for most member-facing reads. */
export const DEFAULT_STALE_MS = 5 * 60 * 1000;

/** Short-lived member dashboard cards and activity summaries. */
export const MEMBER_DASHBOARD_STALE_MS = 60 * 1000;

/** Schedule list rows and class detail in Supabase. */
export const SCHEDULE_PAGE_STALE_MS = 2 * 60 * 1000;

/** Mindbody → Supabase schedule mirror sync. */
export const SCHEDULE_MIRROR_STALE_MS = 2 * 60 * 1000;

/** Coaches, programs, and other rarely changing directory data. */
export const STATIC_DIRECTORY_STALE_MS = 24 * 60 * 60 * 1000;
export const STATIC_DIRECTORY_GC_MS = 48 * 60 * 60 * 1000;

/** Attendance history pages from Supabase. */
export const ATTENDANCE_STALE_MS = 60 * 1000;

/** Mindbody visits mirror sync. */
export const ATTENDANCE_MIRROR_STALE_MS = 5 * 60 * 1000;
export const ATTENDANCE_MIRROR_GC_MS = 10 * 60 * 1000;

/** Membership summary and Mindbody membership mirror. */
export const MEMBERSHIP_STALE_MS = 5 * 60 * 1000;
export const MEMBERSHIP_GC_MS = 30 * 60 * 1000;
export const MEMBERSHIP_MIRROR_GC_MS = 10 * 60 * 1000;

/** Profile reads. */
export const PROFILE_STALE_MS = 5 * 60 * 1000;
export const PROFILE_GC_MS = 30 * 60 * 1000;

/** Coach dashboard, roster, and roll-call state during class. */
export const COACH_LIVE_STALE_MS = 30 * 1000;
export const COACH_DASHBOARD_STALE_MS = 60 * 1000;

/** Notifications and unread badge. */
export const NOTIFICATIONS_STALE_MS = 30 * 1000;

/** Rewards catalog — changes infrequently. */
export const REWARDS_CATALOG_STALE_MS = 24 * 60 * 60 * 1000;

/** Belt path detail and coach member search. */
export const BELT_PATH_STALE_MS = 60 * 1000;
export const COACH_SEARCH_STALE_MS = 30 * 1000;

/** Secure QR tokens must never be persisted or kept in memory after unmount. */
export const SECURE_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  meta: { persist: false },
} as const;

export const DEFAULT_QUERY_OPTIONS = {
  staleTime: DEFAULT_STALE_MS,
  retry: 2,
  retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 10_000),
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;
