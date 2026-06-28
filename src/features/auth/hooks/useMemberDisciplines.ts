import { useQuery } from '@tanstack/react-query';
import {
  getMemberDisciplines,
  getRankEligibility,
} from '@/services/database/discipline.repository';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { MEMBER_DASHBOARD_STALE_MS } from '@/lib/queryCachePolicy';
import type { MemberDisciplineEntitlement, RankEligibility } from '@/types/domain';

export type MemberDisciplineInfo = MemberDisciplineEntitlement;

export function useMemberDisciplines() {
  const activeMemberId = useActiveMemberId();

  return useQuery<MemberDisciplineInfo[]>({
    queryKey: ['member-disciplines', activeMemberId],
    queryFn: () => getMemberDisciplines(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useRankEligibility() {
  const activeMemberId = useActiveMemberId();

  return useQuery<RankEligibility>({
    queryKey: ['rank-eligibility', activeMemberId],
    queryFn: () => getRankEligibility(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}
