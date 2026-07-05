import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAwardPromotion,
  useCoachMemberBeltPath,
  useMarkRequirementStatus,
} from '@/features/belt/hooks/useBeltPath';
import { CoachBeltReviewAwardBar } from '@/features/coach/components/belt/CoachBeltReviewAwardBar';
import { CoachBeltReviewMemberHero } from '@/features/coach/components/belt/CoachBeltReviewMemberHero';
import { CoachBeltReviewRequirementStepper } from '@/features/coach/components/belt/CoachBeltReviewRequirementStepper';
import { AppScrollView } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';

type SelectedMember = {
  userId: string;
  fullName: string;
  email: string;
  rank: string;
  stripes: number;
  avatarUrl: string | null;
  recentCheckIns: number;
};

type Props = {
  member: SelectedMember;
  reviewDiscipline: RankDisciplineSlug;
};

const AWARD_BAR_ESTIMATED_HEIGHT = 132;

export function CoachBeltReviewMemberDetail({ member, reviewDiscipline }: Props) {
  const { colors, inset, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const { showAlert, showConfirm } = useDialog();
  const router = useRouter();

  const [selectedMember, setSelectedMember] = useState(member);

  useEffect(() => {
    setSelectedMember(member);
  }, [member]);

  const beltReviewQuery = useCoachMemberBeltPath(selectedMember.userId, reviewDiscipline);
  const awardPromotionMutation = useAwardPromotion(selectedMember.userId);
  const markRequirementMutation = useMarkRequirementStatus(selectedMember.userId);
  const [updatingRequirementId, setUpdatingRequirementId] = useState<string | null>(null);

  useEffect(() => {
    if (!beltReviewQuery.data) return;

    const { progress } = beltReviewQuery.data;
    setSelectedMember((current) => {
      if (current.userId !== progress.userId) return current;
      if (current.rank === progress.rankName && current.stripes === progress.stripe) {
        return current;
      }
      return {
        ...current,
        rank: progress.rankName,
        stripes: progress.stripe,
      };
    });
  }, [beltReviewQuery.data, selectedMember.userId]);

  const review = useMemo(() => {
    const beltData = beltReviewQuery.data;
    if (!beltData) return null;

    const requirements = beltData.requirements.filter((item) => item.status !== 'locked');

    return {
      percent: beltData.progress.percent,
      trainingDays: beltData.progress.trainingDays,
      stripe: beltData.progress.stripe,
      maxStripes: beltData.progress.maxStripes,
      targetStripe: beltData.targetStripe,
      requirements,
    };
  }, [beltReviewQuery.data]);

  const canAwardStripe = Boolean(review && review.percent >= 100);
  const awardBlockedReason =
    review && review.percent < 100
      ? 'Complete all stripe requirements before awarding the next stripe.'
      : null;

  const scrollBottomInset =
    safeInsets.bottom + inset.sm + layout.coachActionHeight + inset.lg + AWARD_BAR_ESTIMATED_HEIGHT;

  const handleBackToList = useCallback(() => {
    triggerLightImpact();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(coach)/(main)/promotions');
  }, [router]);

  const performMarkRequirementDone = useCallback(
    async (requirementId: string) => {
      setUpdatingRequirementId(requirementId);
      try {
        await markRequirementMutation.mutateAsync({ requirementId, status: 'done' });
        toast.success('Requirement updated');
      } catch (error) {
        showAlert(
          'Could not update requirement',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setUpdatingRequirementId(null);
      }
    },
    [markRequirementMutation, showAlert],
  );

  const handleMarkRequirementDone = useCallback(
    (requirementId: string, title: string) => {
      triggerLightImpact();
      showConfirm(
        'Mark requirement done?',
        `Confirm "${title}" is complete for ${selectedMember.fullName}.`,
        () => {
          void performMarkRequirementDone(requirementId);
        },
        { confirmLabel: 'Mark done' },
      );
    },
    [performMarkRequirementDone, selectedMember.fullName, showConfirm],
  );

  const performAwardStripe = useCallback(async () => {
    if (!review) return;

    try {
      await awardPromotionMutation.mutateAsync({
        discipline: reviewDiscipline,
      });
      toast.success(
        'Stripe awarded',
        `${selectedMember.fullName} is now on stripe ${review.stripe + 1}.`,
      );
      handleBackToList();
    } catch (error) {
      showAlert(
        'Could not award stripe',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [
    awardPromotionMutation,
    handleBackToList,
    review,
    reviewDiscipline,
    selectedMember.fullName,
    showAlert,
  ]);

  const handleAwardStripe = useCallback(() => {
    if (!review || !canAwardStripe) return;

    triggerLightImpact();
    showConfirm(
      'Award stripe?',
      `Promote ${selectedMember.fullName} from stripe ${review.stripe} to stripe ${review.stripe + 1}.`,
      () => {
        void performAwardStripe();
      },
      { confirmLabel: 'Award stripe' },
    );
  }, [canAwardStripe, performAwardStripe, review, selectedMember.fullName, showConfirm]);

  return (
    <View style={styles.flex}>
      <AppScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingHorizontal: inset.lg,
          paddingTop: inset.md,
          paddingBottom: scrollBottomInset,
          gap: gap.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {beltReviewQuery.isLoading ? (
          <StateBlock kind="loading" title="Loading belt progress" />
        ) : beltReviewQuery.error ? (
          <StateBlock
            kind="error"
            title="Could not load belt progress"
            message={
              beltReviewQuery.error instanceof Error
                ? beltReviewQuery.error.message
                : 'Please check your connection.'
            }
            actionLabel="Retry"
            onAction={() => beltReviewQuery.refetch()}
          />
        ) : review ? (
          <>
            <CoachBeltReviewMemberHero
              fullName={selectedMember.fullName}
              avatarUrl={selectedMember.avatarUrl}
              beltRank={selectedMember.rank}
              currentStripe={review.stripe}
              trainingDays={review.trainingDays}
              recentCheckIns={selectedMember.recentCheckIns}
              percent={review.percent}
            />

            <CoachBeltReviewRequirementStepper
              requirements={review.requirements}
              trainingDays={review.trainingDays}
              updatingRequirementId={updatingRequirementId}
              onMarkDone={handleMarkRequirementDone}
            />
          </>
        ) : null}
      </AppScrollView>

      {review ? (
        <CoachBeltReviewAwardBar
          memberName={selectedMember.fullName}
          beltRank={selectedMember.rank}
          targetStripe={review.targetStripe}
          canAward={canAwardStripe}
          loading={awardPromotionMutation.isPending}
          blockedReason={awardBlockedReason}
          onAward={handleAwardStripe}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
