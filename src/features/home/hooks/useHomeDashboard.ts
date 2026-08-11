import { useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDisciplineScore,
  getGymWeekActivity,
  getGym8WeeksActivity,
  getMemberPercentileRank,
} from '@/services/database/discipline.repository';
import { getHomeDashboardSummary } from '@/services/database/homeDashboard.repository';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { beltPathKey } from '@/features/belt/hooks/beltPathKeys';
import { pointsKey } from '@/features/rewards/hooks/rewardsKeys';
import { MEMBER_DASHBOARD_STALE_MS } from '@/lib/queryCachePolicy';
import { homeDashboardKey } from './homeDashboardKeys';
import {
  disciplineKey,
  gym8WeeksActivityKey,
  memberPercentileKey,
  weekActivityKey,
} from './homeActivityKeys';
import type { BeltPathSummary } from '@/types/domain';

export { homeDashboardKey } from './homeDashboardKeys';
export {
  disciplineKey,
  gym8WeeksActivityKey,
  memberPercentileKey,
  weekActivityKey,
} from './homeActivityKeys';

export function useHomeDashboardSummary() {
  const activeMemberId = useActiveMemberId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: homeDashboardKey(activeMemberId),
    queryFn: () => getHomeDashboardSummary(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });

  useEffect(() => {
    if (!activeMemberId || !query.data) return;

    queryClient.setQueryData(pointsKey(activeMemberId), query.data.points);
    queryClient.setQueryData(disciplineKey(activeMemberId), query.data.disciplineScore);
    queryClient.setQueryData(weekActivityKey(activeMemberId), query.data.weekActivity);
    if (query.data.beltProgress) {
      queryClient.setQueryData<BeltPathSummary | undefined>(
        beltPathKey(activeMemberId),
        (current) =>
          current
            ? {
                ...current,
                progress: query.data!.beltProgress!,
              }
            : current,
      );
    } else {
      queryClient.removeQueries({ queryKey: beltPathKey(activeMemberId) });
    }
  }, [activeMemberId, query.data, queryClient]);

  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey: homeDashboardKey(activeMemberId),
        type: 'active',
        stale: true,
      });
    }, [activeMemberId, queryClient]),
  );

  return query;
}

export function useDisciplineScore() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: disciplineKey(activeMemberId),
    queryFn: () => getDisciplineScore(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useMemberPercentileRank() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: memberPercentileKey(activeMemberId),
    queryFn: () => getMemberPercentileRank(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useGymWeekActivity() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: weekActivityKey(activeMemberId),
    queryFn: () => getGymWeekActivity(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useGym8WeeksActivity() {
  const activeMemberId = useActiveMemberId();

  return useQuery({
    queryKey: gym8WeeksActivityKey(activeMemberId),
    queryFn: () => getGym8WeeksActivity(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}
