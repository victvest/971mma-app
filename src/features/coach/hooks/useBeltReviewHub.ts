import { useMemo } from 'react';
import {
  useClassRoster,
  useCurrentCoachClass,
  usePromotionCandidates,
} from '@/features/coach/hooks/useCoachMode';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { useRollCallState } from '@/features/coach/roll-call/hooks/useRollCall';
import type { PromotionCandidateItem } from '@/types/domain';

export type BeltReviewHubMember = PromotionCandidateItem & {
  signedInToday: boolean;
};

function compareHubMembers(a: BeltReviewHubMember, b: BeltReviewHubMember): number {
  const reasonRank = (reason: BeltReviewHubMember['candidateReason']) => {
    if (reason === 'ready_for_stripe') return 0;
    if (reason === 'near_ready') return 1;
    return 2;
  };

  const reasonDelta = reasonRank(a.candidateReason) - reasonRank(b.candidateReason);
  if (reasonDelta !== 0) return reasonDelta;

  return b.percent - a.percent;
}

function hubMemberFromCandidate(
  candidate: PromotionCandidateItem,
  signedInToday: boolean,
): BeltReviewHubMember {
  return { ...candidate, signedInToday };
}

function hubMemberFromRoster(input: {
  userId: string;
  fullName: string;
  beltRank: string | null;
  beltStripes: number;
  avatarUrl?: string | null;
  candidate?: PromotionCandidateItem;
}): BeltReviewHubMember {
  const { candidate, userId, fullName, beltRank, beltStripes, avatarUrl } = input;

  if (candidate) {
    return hubMemberFromCandidate(
      {
        ...candidate,
        avatarUrl: candidate.avatarUrl ?? avatarUrl ?? null,
      },
      true,
    );
  }

  return {
    userId,
    fullName,
    email: '',
    avatarUrl: avatarUrl ?? null,
    beltRank,
    beltStripes,
    percent: 0,
    trainingDays: 0,
    recentCheckIns: 0,
    candidateReason: 'tracking',
    signedInToday: true,
  };
}

export function useBeltReviewHub(discipline: RankDisciplineSlug | null) {
  const { current: heroClass } = useCurrentCoachClass();
  const classId = heroClass?.id ?? null;

  const rollCallQuery = useRollCallState(classId);
  const rosterQuery = useClassRoster(classId);
  const candidatesQuery = usePromotionCandidates(discipline, {
    enabled: discipline !== null,
  });

  const candidates = candidatesQuery.data ?? [];
  const candidatesByUserId = useMemo(
    () => new Map(candidates.map((item) => [item.userId, item])),
    [candidates],
  );

  const signedInToday = useMemo(() => {
    const seen = new Set<string>();
    const members: BeltReviewHubMember[] = [];

    const addMember = (member: BeltReviewHubMember) => {
      if (seen.has(member.userId)) return;
      seen.add(member.userId);
      members.push(member);
    };

    for (const deckMember of rollCallQuery.data?.deck ?? []) {
      if (!deckMember.userId || deckMember.isGuest || !deckMember.hasFacilityCheckInToday) {
        continue;
      }

      addMember(
        hubMemberFromRoster({
          userId: deckMember.userId,
          fullName: deckMember.displayName,
          beltRank: deckMember.beltRank,
          beltStripes: deckMember.beltStripes,
          avatarUrl: deckMember.avatarUrl,
          candidate: candidatesByUserId.get(deckMember.userId),
        }),
      );
    }

    if (members.length === 0) {
      for (const visitor of rosterQuery.data?.visitors ?? []) {
        if (!visitor.userId) continue;
        if (!visitor.checkedInLocally && !visitor.signedInMindbody) continue;

        addMember(
          hubMemberFromRoster({
            userId: visitor.userId,
            fullName: visitor.name,
            beltRank: null,
            beltStripes: 0,
            candidate: candidatesByUserId.get(visitor.userId),
          }),
        );
      }
    }

    return members.sort(compareHubMembers);
  }, [candidatesByUserId, rollCallQuery.data?.deck, rosterQuery.data?.visitors]);

  const readyToPromote = useMemo(() => {
    const signedInIds = new Set(signedInToday.map((item) => item.userId));

    return candidates
      .filter((item) => item.candidateReason !== 'tracking' && !signedInIds.has(item.userId))
      .map((item) => hubMemberFromCandidate(item, false))
      .sort(compareHubMembers);
  }, [candidates, signedInToday]);

  const isLoading =
    candidatesQuery.isLoading || rollCallQuery.isLoading || rosterQuery.isLoading;

  return {
    heroClass,
    signedInToday,
    readyToPromote,
    candidatesQuery,
    rollCallQuery,
    rosterQuery,
    isLoading,
    hasError: Boolean(candidatesQuery.error),
    errorMessage:
      candidatesQuery.error instanceof Error
        ? candidatesQuery.error.message
        : 'Please check your connection.',
    refetch: () =>
      Promise.all([
        candidatesQuery.refetch(),
        rollCallQuery.refetch(),
        rosterQuery.refetch(),
      ]),
  };
}
