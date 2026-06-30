import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Guest access states:
 * - isAnonymousGuest: "Continue as guest" — no Supabase session, preview/mock data only.
 * - needsActivation: authenticated member pending Mindbody link — real account, blocked features.
 * - hasLimitedAccess: either state above; use for action gating and bottom sheets.
 */
export function useIsGuest() {
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);

  const isAnonymousGuest = role === 'guest';
  const isAnonymous = user === null;
  const needsActivation = Boolean(user && user.accountStatus !== 'active');
  const hasLimitedAccess = isAnonymousGuest || needsActivation;

  /** @deprecated Prefer isAnonymousGuest or hasLimitedAccess explicitly. */
  const isGuest = isAnonymousGuest;

  return {
    isGuest,
    isAnonymousGuest,
    isAnonymous,
    needsActivation,
    hasLimitedAccess,
  };
}
