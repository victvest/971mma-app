import { useRouter } from 'expo-router';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import type { BeltReviewHubMember } from '@/features/coach/hooks/useBeltReviewHub';
import type { CoachMemberSearchItem } from '@/types/domain';

type BeltReviewRouter = ReturnType<typeof useRouter>;
type BeltReviewNavMember = BeltReviewHubMember | CoachMemberSearchItem;

export function openCoachBeltReviewMember(
  router: BeltReviewRouter,
  member: BeltReviewNavMember,
  discipline: RankDisciplineSlug,
) {
  const userId = 'userId' in member ? member.userId : member.id;
  if (!userId) return;

  router.push({
    pathname: '/(coach)/belt-review',
    params: {
      memberId: userId,
      memberName: member.fullName,
      memberEmail: member.email ?? '',
      memberRank: member.beltRank ?? 'Unranked',
      memberStripes: String(member.beltStripes ?? 0),
      memberAvatarUrl: 'avatarUrl' in member ? (member.avatarUrl ?? '') : '',
      memberRecentCheckIns: 'recentCheckIns' in member ? String(member.recentCheckIns ?? 0) : '0',
      discipline,
    },
  });
}
