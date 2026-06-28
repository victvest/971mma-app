import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  awardPromotion,
  getBeltPathSummary,
  getCoachMemberBeltPath,
  markRequirementStatus,
  searchMembersForCoach,
} from '@/services/database/belt.repository';
import { invalidateAfterBeltProgressChange } from '@/lib/queryInvalidation';
import {
  BELT_PATH_STALE_MS,
  COACH_SEARCH_STALE_MS,
} from '@/lib/queryCachePolicy';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useRankEligibility } from '@/features/auth/hooks/useMemberDisciplines';
import { useAuthStore } from '@/stores/useAuthStore';

export const beltPathKey = (userId: string) => ['belt-path', userId] as const;

export function useBeltPath(disciplineSlug?: string) {
  const activeMemberId = useActiveMemberId();
  const rankEligibility = useRankEligibility();
  const targetDiscipline = disciplineSlug ?? rankEligibility.data?.disciplineSlug ?? 'bjj';

  return useQuery({
    queryKey: [...beltPathKey(activeMemberId), targetDiscipline],
    queryFn: () =>
      getBeltPathSummary(activeMemberId, targetDiscipline),
    enabled: Boolean(activeMemberId) && rankEligibility.data?.eligible === true,
    staleTime: BELT_PATH_STALE_MS,
  });
}

export function useCoachMemberSearch(query: string) {
  const role = useAuthStore((s) => s.role);
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['coach-member-search', trimmed],
    queryFn: () => searchMembersForCoach(trimmed),
    enabled: (role === 'coach' || role === 'admin') && trimmed.length >= 2,
    staleTime: COACH_SEARCH_STALE_MS,
  });
}

export function useCoachMemberBeltPath(userId: string | null, disciplineSlug = 'bjj') {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: [...beltPathKey(userId ?? 'none'), disciplineSlug],
    queryFn: () => getCoachMemberBeltPath(userId!, disciplineSlug),
    enabled: Boolean(userId) && (role === 'coach' || role === 'admin'),
    staleTime: COACH_SEARCH_STALE_MS,
  });
}

export function useMarkRequirementStatus(targetUserId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { requirementId: string; status: 'now' | 'done' }) => {
      if (!targetUserId) throw new Error('Select a member first.');
      return markRequirementStatus(targetUserId, input.requirementId, input.status);
    },
    onSuccess: () => {
      if (targetUserId) {
        invalidateAfterBeltProgressChange(queryClient, targetUserId);
      }
    },
  });
}

export function useAwardPromotion(targetUserId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { toStripe?: number; toRankId?: string; discipline?: string }) => {
      if (!targetUserId) throw new Error('Select a member first.');
      return awardPromotion(targetUserId, input);
    },
    onSuccess: () => {
      if (targetUserId) {
        invalidateAfterBeltProgressChange(queryClient, targetUserId);
      }
    },
  });
}
