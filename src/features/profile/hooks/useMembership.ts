import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMembershipSummary } from '@/services/database';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import {
  MEMBERSHIP_GC_MS,
  MEMBERSHIP_MIRROR_GC_MS,
  MEMBERSHIP_STALE_MS,
} from '@/lib/queryCachePolicy';
import { shouldInvalidateAfterMirrorSync } from '@/lib/queryRefresh';
import { useAuthStore } from '@/stores/useAuthStore';
import { profileKey } from '@/features/profile/hooks/useProfile';

export const membershipKey = (userId: string) => ['membership', userId] as const;
export const membershipRefreshKey = (userId: string) => ['membership-refresh', userId] as const;

type MembershipRefreshResponse = {
  refreshed: boolean;
  summary: {
    planName: string | null;
    status: 'active' | 'paused' | 'expired' | 'none';
    expiresAt: string | null;
    autoRenew: boolean;
    source: 'mindbody' | null;
    lastSyncedAt: string | null;
    count: number;
  };
};

export function useMembershipRefresh(enabled = true) {
  const activeMemberId = useActiveMemberId();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: membershipRefreshKey(activeMemberId),
    queryFn: async () => {
      const result = await invokeEdge<MembershipRefreshResponse>(
        'mb-membership',
        activeMemberId !== authUserId ? { targetUserId: activeMemberId } : undefined,
      );
      if (shouldInvalidateAfterMirrorSync(result)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: membershipKey(activeMemberId) }),
          queryClient.invalidateQueries({ queryKey: profileKey(activeMemberId) }),
        ]);
      }
      return result;
    },
    enabled: enabled && Boolean(activeMemberId),
    staleTime: MEMBERSHIP_STALE_MS,
    gcTime: MEMBERSHIP_MIRROR_GC_MS,
  });
}

export function useMembership() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: membershipKey(activeMemberId),
    queryFn: () => getMembershipSummary(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBERSHIP_STALE_MS,
    gcTime: MEMBERSHIP_GC_MS,
  });
}

export async function forceMembershipRefresh() {
  const result = await invokeEdge<MembershipRefreshResponse>('mb-membership', { force: true });
  return result;
}

export function useInvalidateMembership() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');

  return async () => {
    if (!userId) return;
    await queryClient.invalidateQueries({ queryKey: membershipKey(userId) });
    await queryClient.invalidateQueries({ queryKey: membershipRefreshKey(userId) });
  };
}
