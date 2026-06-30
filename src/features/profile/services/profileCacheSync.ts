import type { QueryClient } from '@tanstack/react-query';
import type { ProfileSummaryMap } from '@/services/database/guardian.repository';
import type { MemberProfile } from '@/types/domain';
import { profileKey } from '@/features/profile/hooks/useProfile';

/** Cancel stale profile reads, then write the server-confirmed profile everywhere it is cached. */
export async function syncProfileAfterMutation(
  queryClient: QueryClient,
  profile: MemberProfile,
): Promise<void> {
  const userId = profile.id;

  await queryClient.cancelQueries({ queryKey: ['profile'] });
  await queryClient.cancelQueries({ queryKey: ['active-profile-summaries'] });

  queryClient.setQueryData(profileKey(userId), profile);

  queryClient.setQueriesData<ProfileSummaryMap>(
    { queryKey: ['active-profile-summaries'] },
    (current) => {
      if (!current?.[userId]) return current;
      return {
        ...current,
        [userId]: {
          ...current[userId],
          fullName: profile.fullName?.trim() || current[userId].fullName,
          avatarUrl: profile.avatarUrl,
          beltRank: profile.beltRank ?? current[userId].beltRank,
        },
      };
    },
  );
}
