import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '@/services/database';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { PROFILE_GC_MS, PROFILE_STALE_MS } from '@/lib/queryCachePolicy';

export const profileKey = (userId: string) => ['profile', userId] as const;

export function useProfile() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: profileKey(activeMemberId),
    queryFn: () => getMyProfile(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: PROFILE_STALE_MS,
    gcTime: PROFILE_GC_MS,
  });
}
