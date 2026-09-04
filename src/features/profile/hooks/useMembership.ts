import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getMembershipSummary } from '@/services/database';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import {
  MEMBERSHIP_GC_MS,
  MEMBERSHIP_MIRROR_GC_MS,
  MEMBERSHIP_MIRROR_STALE_MS,
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
      // Always force Mindbody → mirror so Check-in / Profile status matches gate access.
      const body =
        activeMemberId !== authUserId
          ? { force: true, targetUserId: activeMemberId }
          : { force: true };
      const result = await invokeEdge<MembershipRefreshResponse>('mb-membership', body);
      if (shouldInvalidateAfterMirrorSync(result, true)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: membershipKey(activeMemberId) }),
          queryClient.invalidateQueries({ queryKey: profileKey(activeMemberId) }),
        ]);
      }
      return result;
    },
    enabled: enabled && Boolean(activeMemberId),
    staleTime: MEMBERSHIP_MIRROR_STALE_MS,
    gcTime: MEMBERSHIP_MIRROR_GC_MS,
    meta: { persist: false },
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

export async function forceMembershipRefresh(targetUserId?: string) {
  const result = await invokeEdge<MembershipRefreshResponse>(
    'mb-membership',
    targetUserId ? { force: true, targetUserId } : { force: true },
  );
  return result;
}

/** Pull-to-refresh / explicit resync: always hits Mindbody, then invalidates local caches. */
export async function syncMembershipFromMindbody(
  queryClient: QueryClient,
  options: { activeMemberId: string; authUserId: string },
): Promise<MembershipRefreshResponse> {
  const { activeMemberId, authUserId } = options;
  const body =
    activeMemberId !== authUserId ? { force: true, targetUserId: activeMemberId } : { force: true };

  const result = await invokeEdge<MembershipRefreshResponse>('mb-membership', body);

  if (shouldInvalidateAfterMirrorSync(result, true)) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: membershipKey(activeMemberId) }),
      queryClient.invalidateQueries({ queryKey: profileKey(activeMemberId) }),
    ]);
  }

  await queryClient.invalidateQueries({ queryKey: membershipRefreshKey(activeMemberId) });

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
