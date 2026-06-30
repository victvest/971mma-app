import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar, AppScrollView, BrandedButton } from '@/shared/components/ui';
import {
  useAwardPromotion,
  useCoachMemberBeltPath,
  useMarkRequirementStatus,
} from '@/features/belt/hooks/useBeltPath';
import { BeltPathSectionTitle } from '@/features/belt/components/BeltPathSectionTitle';
import { CoachMemberSearchList } from '@/features/coach/components/desk/CoachMemberSearchList';
import { CoachRequirementReviewCard } from '@/features/coach/components/belt/CoachRequirementReviewCard';
import { useCoachAssignedDisciplines } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { StateBlock } from '@/shared/components/StateBlock';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachMemberSearchItem } from '@/types/domain';

type SelectedMember = {
  userId: string;
  fullName: string;
  email: string;
  rank: string;
  stripes: number;
};

function BeltReviewContent() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const { showAlert, showConfirm } = useDialog();
  const router = useRouter();

  const params = useLocalSearchParams<{
    memberId?: string;
    memberName?: string;
    memberEmail?: string;
    memberRank?: string;
    memberStripes?: string;
    discipline?: string;
  }>();

  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(() =>
    params.memberId
      ? {
          userId: params.memberId,
          fullName: params.memberName ?? '',
          email: params.memberEmail ?? '',
          rank: params.memberRank ?? 'Unranked',
          stripes: parseInt(params.memberStripes ?? '0', 10),
        }
      : null,
  );

  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const reviewDiscipline =
    (typeof params.discipline === 'string' ? params.discipline : null) ??
    assignedDisciplinesQuery.primaryRankDisciplineSlug ??
    'bjj';

  const selectedMemberId = selectedMember?.userId ?? null;

  const beltReviewQuery = useCoachMemberBeltPath(selectedMemberId, reviewDiscipline);
  const awardPromotionMutation = useAwardPromotion(selectedMemberId);
  const markRequirementMutation = useMarkRequirementStatus(selectedMemberId);
  const [updatingRequirementId, setUpdatingRequirementId] = useState<string | null>(null);

  useEffect(() => {
    if (!params.memberId) return;
    setSelectedMember({
      userId: params.memberId,
      fullName: params.memberName ?? '',
      email: params.memberEmail ?? '',
      rank: params.memberRank ?? 'Unranked',
      stripes: parseInt(params.memberStripes ?? '0', 10),
    });
  }, [
    params.memberEmail,
    params.memberId,
    params.memberName,
    params.memberRank,
    params.memberStripes,
  ]);

  useEffect(() => {
    if (!beltReviewQuery.data || !selectedMember) return;

    const { progress } = beltReviewQuery.data;
    setSelectedMember((current) => {
      if (!current || current.userId !== progress.userId) return current;
      if (current.rank === progress.rankName && current.stripes === progress.stripe) {
        return current;
      }
      return {
        ...current,
        rank: progress.rankName,
        stripes: progress.stripe,
      };
    });
  }, [beltReviewQuery.data, selectedMember?.userId]);

  const review = useMemo(() => {
    const beltData = beltReviewQuery.data;
    if (!beltData) return null;

    return {
      percent: beltData.progress.percent,
      trainingDays: beltData.progress.trainingDays,
      stripe: beltData.progress.stripe,
      maxStripes: beltData.progress.maxStripes,
      requirements: beltData.requirements.filter((item) => item.status !== 'locked'),
    };
  }, [beltReviewQuery.data]);

  const canAwardStripe = Boolean(review && review.percent >= 100);
  const awardBlockedReason =
    review && review.percent < 100
      ? 'Complete all stripe requirements before awarding the next stripe.'
      : null;

  const handleSelectMember = useCallback((member: CoachMemberSearchItem) => {
    triggerLightImpact();
    setSelectedMember({
      userId: member.id,
      fullName: member.fullName,
      email: member.email,
      rank: member.beltRank ?? 'Unranked',
      stripes: member.beltStripes,
    });
  }, []);

  const handleClearMember = useCallback(() => {
    triggerLightImpact();
    setSelectedMember(null);
  }, []);

  const handleMarkRequirementDone = useCallback(
    async (requirementId: string) => {
      if (!selectedMember) return;

      triggerLightImpact();
      setUpdatingRequirementId(requirementId);
      try {
        await markRequirementMutation.mutateAsync({ requirementId, status: 'done' });
        showAlert('Requirement updated', `${selectedMember.fullName}'s progress has been updated.`);
      } catch (error) {
        showAlert(
          'Could not update requirement',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setUpdatingRequirementId(null);
      }
    },
    [markRequirementMutation, selectedMember, showAlert],
  );

  const performAwardStripe = useCallback(async () => {
    if (!selectedMember || !review) return;

    try {
      await awardPromotionMutation.mutateAsync({
        discipline: reviewDiscipline,
      });
      showAlert(
        'Stripe awarded',
        `${selectedMember.fullName} is now on stripe ${review.stripe + 1}.`,
      );
    } catch (error) {
      showAlert(
        'Could not award stripe',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [awardPromotionMutation, review, reviewDiscipline, selectedMember, showAlert]);

  const handleAwardStripe = useCallback(() => {
    if (!selectedMember || !review) return;

    triggerLightImpact();
    showConfirm(
      'Award stripe?',
      `Promote ${selectedMember.fullName} from stripe ${review.stripe} to stripe ${review.stripe + 1}.`,
      () => {
        void performAwardStripe();
      },
      { confirmLabel: 'Award stripe' },
    );
  }, [performAwardStripe, review, selectedMember, showConfirm]);

  if (!assignedDisciplinesQuery.isLoading && !assignedDisciplinesQuery.primaryRankDisciplineSlug) {
    return (
      <View style={[styles.center, { paddingHorizontal: inset.lg, paddingTop: inset['3xl'] }]}>
        <StateBlock
          kind="empty"
          title="No rank discipline assigned"
          message="Belt reviews are available when your coach profile is linked to BJJ or Wrestling."
        />
      </View>
    );
  }

  if (!selectedMember) {
    return (
      <AppScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingHorizontal: inset.lg,
          paddingTop: inset.lg,
          paddingBottom: inset['3xl'],
          gap: gap.lg,
        }}
      >
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Search a member to review skill requirements and award stripes for{' '}
          {assignedDisciplinesQuery.primaryRankDiscipline?.displayName ?? 'your discipline'}.
        </Text>
        <CoachMemberSearchList onSelectMember={handleSelectMember} />
      </AppScrollView>
    );
  }

  return (
    <AppScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: inset.lg,
        paddingTop: inset.lg,
        paddingBottom: inset['3xl'],
        gap: gap.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.memberHeader}>
        <Text style={[typography.textPresets.metricLabel, { color: colors.text.secondary }]}>
          SELECTED MEMBER
        </Text>
        <Pressable onPress={handleClearMember} accessibilityRole="button">
          <Text style={[typography.textPresets.footnote, { color: colors.accent.default }]}>
            Change member
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.selectedCard,
          {
            backgroundColor: colors.surface.promo,
            borderColor: colors.border.onPromo,
            borderRadius: radius.cardLarge,
            padding: inset.md,
            gap: gap.md,
          },
        ]}
      >
        <View style={styles.selectedMemberInfo}>
          <Text
            style={[typography.textPresets.callout, { color: colors.text.onPromo }]}
            numberOfLines={1}
          >
            {selectedMember.fullName}
          </Text>
          <Text
            style={[
              typography.textPresets.footnote,
              { color: colors.text.onPromoMuted, marginTop: gap.xs },
            ]}
          >
            {selectedMember.rank} · Stripe {selectedMember.stripes}
          </Text>
          {review ? (
            <Text
              style={[
                typography.textPresets.footnote,
                { color: colors.text.onPromoMuted, marginTop: gap.xs },
              ]}
            >
              {review.trainingDays} training days
            </Text>
          ) : null}
        </View>

        {review ? (
          <View style={[styles.progressRow, { gap: gap.sm }]}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.fill.secondary, borderRadius: radius.pill },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, review.percent)}%`,
                    backgroundColor: colors.accent.default,
                    borderRadius: radius.pill,
                  },
                ]}
              />
            </View>
            <Text style={[typography.textPresets.metricValue, { color: colors.text.onPromo }]}>
              {review.percent.toFixed(0)}%
            </Text>
          </View>
        ) : null}
      </View>

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
          <View style={{ gap: gap.md }}>
            <BeltPathSectionTitle title="Stripe requirements" />
            {review.requirements.length === 0 ? (
              <View style={{ gap: gap.sm }}>
                <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                  No active requirements for this stripe yet.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(coach)/curriculum')}
                >
                  <Text style={[typography.textPresets.footnote, { color: colors.accent.default }]}>
                    Manage curriculum requirements
                  </Text>
                </Pressable>
              </View>
            ) : (
              review.requirements.map((item) => (
                <CoachRequirementReviewCard
                  key={item.id}
                  item={item}
                  trainingDays={review.trainingDays}
                  isUpdating={updatingRequirementId === item.id}
                  onMarkDone={handleMarkRequirementDone}
                />
              ))
            )}
          </View>

          <View style={{ gap: gap.sm }}>
            <BeltPathSectionTitle title="Promotion" />
            <BrandedButton
              label="Award stripe"
              full
              loading={awardPromotionMutation.isPending}
              disabled={!canAwardStripe || awardPromotionMutation.isPending}
              onPress={handleAwardStripe}
            />
            {awardBlockedReason ? (
              <Text
                style={[
                  typography.textPresets.caption,
                  { color: colors.text.tertiary, textAlign: 'center' },
                ]}
              >
                {awardBlockedReason}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </AppScrollView>
  );
}

export default function CoachBeltReviewScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title="Belt review" showBackButton />
      <BeltReviewContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1 },
  memberHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedCard: { borderWidth: 1 },
  selectedMemberInfo: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: { flex: 1, height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
