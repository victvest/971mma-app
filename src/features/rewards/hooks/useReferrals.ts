import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyReferralCode,
  getMyReferralCode,
  getMyReferrals,
  getMyReferralStatus,
} from '@/services/database/referrals.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import { ledgerKey, pointsKey } from '@/features/rewards/hooks/useRewards';
import { MEMBER_DASHBOARD_STALE_MS } from '@/lib/queryCachePolicy';

export const referralCodeKey = (userId: string) => ['referral-code', userId] as const;
export const referralsKey = (userId: string) => ['referrals', userId] as const;
export const referralStatusKey = ['referral-status'] as const;

export function useReferralCode() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const accountStatus = useAuthStore((s) => s.user?.accountStatus ?? 'registered');

  return useQuery({
    queryKey: referralCodeKey(userId),
    queryFn: getMyReferralCode,
    enabled: Boolean(userId) && accountStatus === 'active',
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useReferrals() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: referralsKey(userId),
    queryFn: getMyReferrals,
    enabled: Boolean(userId),
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useReferralStatus() {
  return useQuery({
    queryKey: referralStatusKey,
    queryFn: getMyReferralStatus,
    staleTime: MEMBER_DASHBOARD_STALE_MS,
  });
}

export function useApplyReferralCode() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => applyReferralCode(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referralStatusKey });
      void queryClient.invalidateQueries({ queryKey: referralsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: pointsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: ledgerKey(userId) });
    },
  });
}
