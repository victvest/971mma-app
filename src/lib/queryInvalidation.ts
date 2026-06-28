import type { QueryClient } from '@tanstack/react-query';
import { beltPathKey } from '@/features/belt/hooks/useBeltPath';
import {
  coachStatsKey,
  promotionCandidatesKey,
} from '@/features/coach/hooks/useCoachMode';
import { disciplineKey, homeDashboardKey } from '@/features/home/hooks/useHomeDashboard';
import { ledgerKey, milestonesKey, pointsKey, redemptionsKey } from '@/features/rewards/hooks/useRewards';
import { attendanceKey } from '@/features/checkin/hooks/useCheckin';

type MemberActivityInvalidation = {
  classId?: string;
  includeCoachViews?: boolean;
};

/** Member check-in / entrance check-in: invalidate exactly the member-scoped caches that change. */
export function invalidateAfterMemberCheckin(
  queryClient: QueryClient,
  memberId: string,
  options: MemberActivityInvalidation = {},
) {
  void queryClient.invalidateQueries({ queryKey: attendanceKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: homeDashboardKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: beltPathKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: milestonesKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: disciplineKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: pointsKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: ledgerKey(memberId) });

  if (options.includeCoachViews !== false) {
    void queryClient.invalidateQueries({ queryKey: ['checkins'] });
    void queryClient.invalidateQueries({ queryKey: ['coach-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: coachStatsKey });
    if (options.classId) {
      void queryClient.invalidateQueries({ queryKey: ['coach-roster', options.classId] });
    }
  }
}

/** Belt requirement / promotion writes for a member. */
export function invalidateAfterBeltProgressChange(
  queryClient: QueryClient,
  memberId: string,
) {
  void queryClient.invalidateQueries({ queryKey: homeDashboardKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: beltPathKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: milestonesKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: disciplineKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: pointsKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: ledgerKey(memberId) });
  void queryClient.invalidateQueries({ queryKey: promotionCandidatesKey });
  void queryClient.invalidateQueries({ queryKey: ['coach-dashboard'] });
  void queryClient.invalidateQueries({ queryKey: coachStatsKey });
}

/** Reward redemption updates points and redemption history only. */
export function invalidateAfterRewardRedemption(
  queryClient: QueryClient,
  userId: string,
) {
  void queryClient.invalidateQueries({ queryKey: homeDashboardKey(userId) });
  void queryClient.invalidateQueries({ queryKey: pointsKey(userId) });
  void queryClient.invalidateQueries({ queryKey: ledgerKey(userId) });
  void queryClient.invalidateQueries({ queryKey: redemptionsKey(userId) });
}
