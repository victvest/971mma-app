import { useQuery } from '@tanstack/react-query';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useAuthStore } from '@/stores/useAuthStore';

export const mindbodyClientInfoKey = (userId: string) => ['mindbody-client-info', userId] as const;

export type MindbodyClientInfo = {
  clientId: string | null;
  barcode: string | null;
  fetchedAt: string;
};

export function useMindbodyClientInfo(enabled = true) {
  const activeMemberId = useActiveMemberId();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: mindbodyClientInfoKey(activeMemberId),
    queryFn: () =>
      invokeEdge<MindbodyClientInfo>(
        'mb-client-info',
        activeMemberId !== authUserId ? { targetUserId: activeMemberId } : undefined,
      ),
    enabled: enabled && Boolean(activeMemberId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
