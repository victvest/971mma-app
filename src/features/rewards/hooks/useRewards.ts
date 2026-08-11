import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCatalog,
  getLedgerPage,
  getMyMilestones,
  getMyRedemptions,
  getPointsAccount,
  redeem,
} from '@/services/database';
import { getAppSettings } from '@/services/database/appSettings.repository';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { invalidateAfterRewardRedemption } from '@/lib/queryInvalidation';
import { MEMBER_DASHBOARD_STALE_MS, REWARDS_CATALOG_STALE_MS } from '@/lib/queryCachePolicy';
import {
  appSettingsKey,
  catalogKey,
  ledgerKey,
  milestonesKey,
  pointsKey,
  redemptionsKey,
} from './rewardsKeys';

export {
  appSettingsKey,
  catalogKey,
  ledgerKey,
  milestonesKey,
  pointsKey,
  redemptionsKey,
} from './rewardsKeys';

export function usePoints() {
  const activeMemberId = useActiveMemberId();
  return useQuery({
    queryKey: pointsKey(activeMemberId),
    queryFn: () => getPointsAccount(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: catalogKey,
    queryFn: getCatalog,
    staleTime: REWARDS_CATALOG_STALE_MS,
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    queryFn: getAppSettings,
    staleTime: REWARDS_CATALOG_STALE_MS,
  });
}

export function useLedger() {
  const activeMemberId = useActiveMemberId();
  return useQuery({
    queryKey: ledgerKey(activeMemberId),
    queryFn: () => getLedgerPage(0, 12, activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useMilestones() {
  const activeMemberId = useActiveMemberId();
  return useQuery({
    queryKey: milestonesKey(activeMemberId),
    queryFn: () => getMyMilestones(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useRedemptions() {
  const activeMemberId = useActiveMemberId();
  return useQuery({
    queryKey: redemptionsKey(activeMemberId),
    queryFn: () => getMyRedemptions(activeMemberId),
    enabled: Boolean(activeMemberId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useRedeem() {
  const activeMemberId = useActiveMemberId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => redeem(rewardId, activeMemberId),
    onSuccess: () => {
      invalidateAfterRewardRedemption(queryClient, activeMemberId);
    },
  });
}
