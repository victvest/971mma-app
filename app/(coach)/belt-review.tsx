import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar, AppScrollView, BrandedButton } from '@/shared/components/ui';
import { useAwardPromotion, useCoachMemberBeltPath } from '@/features/belt/hooks/useBeltPath';
import { StateBlock } from '@/shared/components/StateBlock';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

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

  const selectedMemberId = selectedMember?.userId ?? null;

  const beltReviewQuery = useCoachMemberBeltPath(selectedMemberId, params.discipline ?? 'bjj');
  const awardPromotionMutation = useAwardPromotion(selectedMemberId);

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
    };
  }, [beltReviewQuery.data]);

  const canAwardStripe = Boolean(review && review.percent >= 100);
  const awardBlockedReason =
    review && review.percent < 100
      ? 'Member must reach 100% on current stripe requirements before awarding.'
      : null;

  const performAwardStripe = useCallback(async () => {
    if (!selectedMember || !review) return;

    try {
      await awardPromotionMutation.mutateAsync({ discipline: params.discipline ?? 'bjj' });
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
  }, [awardPromotionMutation, review, selectedMember, showAlert, params.discipline]);

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

  if (!selectedMember) {
    return (
      <View style={styles.flex}>
        <View style={[styles.center, { paddingTop: inset['3xl'], paddingHorizontal: inset.lg }]}>
          <StateBlock
            kind="empty"
            title="No member selected"
            message="Open a candidate from the Promote tab to review belt progress."
          />
        </View>
      </View>
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
      <Text style={[typography.textPresets.metricLabel, { color: colors.text.secondary }]}>
        SELECTED MEMBER
      </Text>

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
        <View style={{ gap: gap.sm }}>
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
      <AppBar title="Belt Review" showBackButton />
      <BeltReviewContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1 },
  selectedCard: { borderWidth: 1 },
  selectedMemberInfo: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: { flex: 1, height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
