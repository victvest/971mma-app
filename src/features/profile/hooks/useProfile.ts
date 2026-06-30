import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '@/services/database';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useAuthStore } from '@/stores/useAuthStore';
import { PROFILE_GC_MS, PROFILE_STALE_MS } from '@/lib/queryCachePolicy';

export const profileKey = (userId: string) => ['profile', userId] as const;

function useProfileQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKey(userId ?? ''),
    queryFn: () => getMyProfile(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: PROFILE_STALE_MS,
    gcTime: PROFILE_GC_MS,
  });
}

/** Profile for the active family member (self or selected trainee). */
export function useProfile() {
  const activeMemberId = useActiveMemberId();
  return useProfileQuery(activeMemberId);
}

/** Signed-in member's own profile — use on edit-profile, never the active trainee switch. */
export function useAuthProfile() {
  const authUserId = useAuthStore((state) => state.user?.id);
  return useProfileQuery(authUserId);
}
