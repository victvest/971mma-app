import { useQuery } from '@tanstack/react-query';
import { getGuardianChildrenSummary } from '@/services/database/guardianChildren.repository';
import { useAuthStore } from '@/stores/useAuthStore';

export const guardianChildrenSummaryKey = (userId: string) =>
  ['guardian-children-summary', userId] as const;

export function useGuardianChildrenSummary(enabled = true) {
  const authUserId = useAuthStore((state) => state.user?.id ?? '');

  return useQuery({
    queryKey: guardianChildrenSummaryKey(authUserId),
    queryFn: getGuardianChildrenSummary,
    enabled: enabled && Boolean(authUserId),
    staleTime: 60 * 1000,
  });
}
