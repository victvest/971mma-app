import React, { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import {
  AnimatedProgressFill,
  LoadingCrossfade,
  RewardsSkeleton,
  RewardsMilestonesSkeleton,
} from '@/shared/animations';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog';
import { triggerSuccessNotification, triggerLightImpact } from '@/shared/haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import { PremiumLockOverlay } from '@/shared/components/PremiumLockOverlay';
import { MilestoneRow } from '@/features/rewards/components/MilestoneRow';
import { PointsBalanceCard } from '@/features/rewards/components/PointsBalanceCard';
import { RewardCatalogCard } from '@/features/rewards/components/RewardCatalogCard';
import { RewardsSectionHeader } from '@/features/rewards/components/RewardsSectionHeader';
import { RewardsSectionTitle } from '@/features/rewards/components/RewardsSectionTitle';
import {
  useCatalog,
  useLedger,
  useMilestones,
  usePoints,
  useRedeem,
  useRedemptions,
} from '@/features/rewards/hooks/useRewards';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { useDisciplineScore, useGymWeekActivity } from '@/features/home/hooks/useHomeDashboard';
import { useTheme } from '@/shared/theme';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppScrollView } from '@/shared/components/ui';
import type {
  DisciplineScoreSummary,
  GymDayActivity,
  MilestoneItem,
  PointsLedgerItem,
  RedemptionItem,
  RedemptionStatus,
} from '@/types/domain';

const REDEMPTION_STATUS_ORDER: RedemptionStatus[] = ['pending', 'fulfilled', 'refunded', 'cancelled'];

type RedemptionListItem =
  | { id: string; type: 'header'; status: RedemptionStatus; count: number }
  | { id: string; type: 'redemption'; redemption: RedemptionItem };

type StreakInsight = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  eyebrow: string;
  progressPct: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

function getRedemptionStatusCopy(status: RedemptionStatus): string {
  if (status === 'fulfilled') return 'Fulfilled';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'refunded') return 'Refunded';
  return 'Pending';
}

function getRedemptionStatusIcon(status: RedemptionStatus): React.ComponentProps<typeof Ionicons>['name'] {
  if (status === 'fulfilled') return 'checkmark-circle-outline';
  if (status === 'cancelled') return 'close-circle-outline';
  if (status === 'refunded') return 'return-down-back-outline';
  return 'time-outline';
}

function formatRedemptionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildRedemptionList(redemptions: RedemptionItem[]): RedemptionListItem[] {
  return REDEMPTION_STATUS_ORDER.flatMap((status) => {
    const items = redemptions.filter((redemption) => redemption.status === status);
    if (items.length === 0) return [];

    return [
      { id: `header-${status}`, type: 'header', status, count: items.length } as const,
      ...items.map((redemption) => ({
        id: redemption.id,
        type: 'redemption' as const,
        redemption,
      })),
    ];
  });
}

function countWeekSessions(weekActivity: GymDayActivity[]): number {
  return weekActivity.filter((day) => day.trained).length;
}

function pluralizeDays(value: number): string {
  return value === 1 ? '1 day' : `${value} days`;
}

function buildStreakInsights(
  score: DisciplineScoreSummary | undefined,
  weekActivity: GymDayActivity[],
  milestones: MilestoneItem[],
): StreakInsight[] {
  const currentStreak = score?.currentStreak ?? 0;
  const bestStreak = score?.bestStreak ?? 0;
  const status = score?.streakStatus ?? (currentStreak > 0 ? 'active' : 'inactive');
  const nextMilestone = milestones.find((item) => item.status === 'next') ?? null;
  const trainingDays = score?.trainingDays ?? 0;
  const monthlyPct = Math.round(Math.min(1, Math.max(0, score?.monthlyGoalPct ?? 0)) * 100);
  const weekSessions = countWeekSessions(weekActivity);

  const streakSubtitle =
    status === 'grace'
      ? 'Grace window active. Train today to keep the streak alive.'
      : status === 'broken'
        ? 'Your next counted class starts a fresh streak.'
        : currentStreak > 0
          ? 'One missed day is protected; multiple gaps reset it.'
          : 'A counted class starts your first streak.';

  const nextRemaining = nextMilestone
    ? Math.max(0, nextMilestone.unlockDays - trainingDays)
    : 0;

  return [
    {
      id: 'streak-status',
      title: currentStreak > 0 ? `${pluralizeDays(currentStreak)} streak` : 'Start your streak',
      subtitle: streakSubtitle,
      value: bestStreak > 0 ? `Best ${pluralizeDays(bestStreak)}` : 'Best pending',
      eyebrow: status === 'grace' ? 'Grace' : 'Current',
      progressPct: Math.min(100, (currentStreak / Math.max(bestStreak, 7, currentStreak)) * 100),
      icon: status === 'grace' ? 'hourglass-outline' : 'flame',
    },
    {
      id: 'next-milestone',
      title: nextMilestone ? nextMilestone.name : 'Milestones synced',
      subtitle: nextMilestone
        ? `${pluralizeDays(nextRemaining)} to unlock${nextMilestone.pointsAward > 0 ? ` +${nextMilestone.pointsAward} pts` : ''}.`
        : 'Every visible milestone is already earned.',
      value: nextMilestone ? `${trainingDays} / ${nextMilestone.unlockDays}` : `${trainingDays} days`,
      eyebrow: 'Next',
      progressPct: nextMilestone ? Math.min(100, (trainingDays / nextMilestone.unlockDays) * 100) : 100,
      icon: nextMilestone ? 'medal-outline' : 'checkmark-circle-outline',
    },
    {
      id: 'monthly-rhythm',
      title: `${monthlyPct}% monthly rhythm`,
      subtitle: `${weekSessions} counted session${weekSessions === 1 ? '' : 's'} in the visible training week.`,
      value: `${score?.trainingDays30d ?? 0} / 12`,
      eyebrow: '30 days',
      progressPct: monthlyPct,
      icon: 'pulse-outline',
    },
  ];
}

function getLedgerReasonLabel(reason: PointsLedgerItem['reason']): string {
  if (reason === 'check_in') return 'Class check-in';
  if (reason === 'redeem') return 'Reward redemption';
  if (reason === 'milestone') return 'Milestone award';
  if (reason === 'promotion') return 'Promotion award';
  if (reason === 'referral') return 'Referral award';
  if (reason === 'birthday') return 'Birthday award';
  if (reason === 'adjustment') return 'Adjustment';
  return 'Bonus';
}

function getLedgerIcon(reason: PointsLedgerItem['reason']): React.ComponentProps<typeof Ionicons>['name'] {
  if (reason === 'redeem') return 'gift-outline';
  if (reason === 'milestone') return 'medal-outline';
  if (reason === 'promotion') return 'ribbon-outline';
  if (reason === 'referral') return 'person-add-outline';
  if (reason === 'birthday') return 'sparkles-outline';
  if (reason === 'adjustment') return 'swap-horizontal-outline';
  if (reason === 'bonus') return 'add-circle-outline';
  return 'checkmark-circle-outline';
}

function formatSignedPoints(delta: number): string {
  const absolute = Math.abs(delta).toLocaleString('en-US');
  return delta >= 0 ? `+${absolute}` : `-${absolute}`;
}

type RedemptionHistoryRowProps = {
  item: RedemptionListItem;
};

const RedemptionHistoryRow = memo(function RedemptionHistoryRow({ item }: RedemptionHistoryRowProps) {
  const { colors, radius, layout } = useTheme();

  if (item.type === 'header') {
    return (
      <View style={styles.redemptionStatusHeader}>
        <Text style={[styles.redemptionStatusTitle, { color: colors.text.secondary }]}>
          {getRedemptionStatusCopy(item.status)}
        </Text>
        <Text style={[styles.redemptionStatusCount, { color: colors.text.tertiary }]}>
          {item.count}
        </Text>
      </View>
    );
  }

  const { redemption } = item;
  const statusLabel = getRedemptionStatusCopy(redemption.status);
  const rewardName = redemption.rewardName ?? 'Reward no longer in catalog';

  return (
    <View
      style={[
        styles.redemptionRow,
        {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          borderRadius: radius.card,
        },
      ]}
    >
      <View style={styles.redemptionIcon}>
        <Ionicons name={getRedemptionStatusIcon(redemption.status)} size={18} color={colors.accent.default} />
      </View>
      <View style={styles.redemptionContent}>
        <Text style={[styles.redemptionTitle, { color: colors.text.primary }]} numberOfLines={2}>
          {rewardName}
        </Text>
        <Text style={[styles.redemptionMeta, { color: colors.text.secondary }]}>
          {redemption.costPoints.toLocaleString('en-US')} pts · {formatRedemptionDate(redemption.createdAt)}
        </Text>
      </View>
      <View style={[styles.redemptionStatusBadge, { backgroundColor: colors.fill.secondary }]}>
        <Text style={[styles.redemptionStatusBadgeText, { color: colors.text.secondary }]}>
          {statusLabel.toUpperCase()}
        </Text>
      </View>
    </View>
  );
});

type StreakInsightCardProps = {
  insight: StreakInsight;
};

const StreakInsightCard = memo(function StreakInsightCard({ insight }: StreakInsightCardProps) {
  const { colors, typography, radius, gap, shadows, layout } = useTheme();

  return (
    <View
      style={[
        styles.insightCard,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          padding: gap.lg,
          gap: gap.md,
        },
      ]}
    >
      <View style={styles.insightHeader}>
        <View style={[styles.insightIcon, { backgroundColor: colors.accent.subtle }]}>
          <Ionicons name={insight.icon} size={22} color={colors.accent.default} />
        </View>
        <View style={[styles.insightBadge, { backgroundColor: colors.fill.secondary }]}>
          <Text style={[styles.insightBadgeText, { color: colors.text.secondary }]}>{insight.eyebrow}</Text>
        </View>
      </View>

      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]} numberOfLines={2}>
          {insight.title}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]} numberOfLines={3}>
          {insight.subtitle}
        </Text>
      </View>

      <View style={{ gap: gap.xs }}>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, { color: colors.text.tertiary }]}>STATE</Text>
          <Text style={[styles.progressValue, { color: colors.text.primary }]}>{insight.value}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.fill.secondary, borderRadius: radius.pill }]}>
          <AnimatedProgressFill
            percent={insight.progressPct}
            backgroundColor={colors.accent.default}
            style={[styles.progressFill, { borderRadius: radius.pill }]}
          />
        </View>
      </View>
    </View>
  );
});

type PointsActivityRowProps = {
  item: PointsLedgerItem;
};

const PointsActivityRow = memo(function PointsActivityRow({ item }: PointsActivityRowProps) {
  const { colors, radius, layout } = useTheme();
  const isPositive = item.delta >= 0;
  const date = new Date(item.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

  return (
    <View
      style={[
        styles.ledgerRow,
        {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
        },
      ]}
    >
      <View style={[styles.ledgerIcon, { backgroundColor: isPositive ? colors.accent.subtle : colors.fill.secondary }]}>
        <Ionicons
          name={getLedgerIcon(item.reason)}
          size={18}
          color={isPositive ? colors.accent.default : colors.text.secondary}
        />
      </View>
      <View style={styles.ledgerContent}>
        <Text style={[styles.ledgerTitle, { color: colors.text.primary }]} numberOfLines={1}>
          {getLedgerReasonLabel(item.reason)}
        </Text>
        <Text style={[styles.ledgerMeta, { color: colors.text.secondary }]}>
          {dateLabel} · Balance {item.balanceAfter.toLocaleString('en-US')}
        </Text>
      </View>
      <Text
        style={[
          styles.ledgerDelta,
          { color: isPositive ? colors.accent.default : colors.status.error },
        ]}
      >
        {formatSignedPoints(item.delta)}
      </Text>
    </View>
  );
});

export default function RewardsScreen() {
  const { colors, typography, inset, radius, layout, gap } = useTheme();
  const { contentBottomInset } = useResponsiveLayout();
  const { showConfirm } = useDialog();
  const router = useRouter();
  const topInset = useAppTopInset();
  const floatingNavTop = topInset + inset.xs;
  const floatingNavHeight = NAV_CHROME.clusterHeight;
  const scrollTopInset = floatingNavTop + floatingNavHeight + inset.sm;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const animatedHeaderTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 85], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [40, 85], [8, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const animatedHeroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 80], [0, -20], Extrapolation.CLAMP),
      },
    ],
  }));

  const viewingChild = useIsViewingChildProfile();
  const pointsQuery = usePoints();
  const milestonesQuery = useMilestones();
  const catalogQuery = useCatalog();
  const redemptionsQuery = useRedemptions();
  const ledgerQuery = useLedger();
  const redeemMutation = useRedeem();
  const scoreQuery = useDisciplineScore();
  const weekActivityQuery = useGymWeekActivity();

  const [refreshing, setRefreshing] = useState(false);

  const role = useAuthStore((s) => s.role);
  const userStore = useAuthStore((s) => s.user);
  const isGuest = role === 'guest' || (role === 'member' && userStore?.accountStatus !== 'active');

  const mockScore = {
    score: 85,
    trainingDays: 15,
    trainingDays30d: 8,
    currentStreak: 3,
    bestStreak: 8,
    streakStatus: 'active' as const,
    monthlyGoalPct: 0.5,
    computedAt: new Date().toISOString(),
    isPlaceholderWeights: false,
  };
  const mockWeekActivity: GymDayActivity[] = [];

  const account = isGuest ? {
    balance: 1250,
    tier: 'silver' as const,
    lifetimePoints: 2500,
  } : (pointsQuery.data ?? {
    balance: 0,
    tier: 'bronze' as const,
    lifetimePoints: 0,
  });

  const pendingRewardId = redeemMutation.variables ?? null;
  const trainingDays = isGuest ? 15 : (scoreQuery.data?.trainingDays ?? 0);

  const errorMessage =
    redeemMutation.error && typeof redeemMutation.error === 'object' && 'message' in redeemMutation.error
      ? String((redeemMutation.error as { message: unknown }).message)
      : null;

  const milestones = useMemo(() => milestonesQuery.data ?? [], [milestonesQuery.data]);
  const rewards = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const redemptions = useMemo(() => isGuest ? [] : (redemptionsQuery.data ?? []), [redemptionsQuery.data, isGuest]);
  const ledgerItems = useMemo(() => isGuest ? [] : (ledgerQuery.data ?? []), [ledgerQuery.data, isGuest]);

  const sortedMilestones = useMemo(() => {
    return [...milestones].sort((a, b) => a.unlockDays - b.unlockDays);
  }, [milestones]);

  const milestoneIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedMilestones.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [sortedMilestones]);

  const redemptionList = useMemo(() => buildRedemptionList(redemptions), [redemptions]);

  const streakInsights = useMemo(
    () => buildStreakInsights(isGuest ? mockScore : scoreQuery.data, isGuest ? mockWeekActivity : (weekActivityQuery.data ?? []), sortedMilestones),
    [scoreQuery.data, sortedMilestones, weekActivityQuery.data, isGuest],
  );

  const handleRedeem = useCallback(
    (rewardId: string) => {
      if (viewingChild) return;

      const reward = rewards.find((item) => item.id === rewardId);
      if (!reward) return;

      showConfirm(
        `Redeem ${reward.name}?`,
        `${reward.costPoints.toLocaleString('en-US')} points will be deducted from your balance.`,
        () =>
          redeemMutation.mutate(rewardId, {
            onSuccess: () => {
              triggerSuccessNotification();
              toast.success('Reward redeemed', 'Your redemption is being processed.');
            },
          }),
        { confirmLabel: 'Redeem' },
      );
    },
    [redeemMutation, rewards, showConfirm, viewingChild],
  );

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await Promise.all([
        pointsQuery.refetch(),
        milestonesQuery.refetch(),
        catalogQuery.refetch(),
        redemptionsQuery.refetch(),
        ledgerQuery.refetch(),
        scoreQuery.refetch(),
        weekActivityQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    pointsQuery,
    milestonesQuery,
    catalogQuery,
    redemptionsQuery,
    ledgerQuery,
    scoreQuery,
    weekActivityQuery,
  ]);

  const renderMilestone = useCallback(
    (item: MilestoneItem) => {
      const idx = milestoneIndexMap.get(item.id) ?? 0;
      const prevDays = idx > 0 ? (sortedMilestones[idx - 1]?.unlockDays ?? 0) : 0;
      const nextDays = item.unlockDays;
      let progressPct = 0;
      if (nextDays > prevDays) {
        progressPct = Math.min(100, Math.max(0, ((trainingDays - prevDays) / (nextDays - prevDays)) * 100));
      }
      return <MilestoneRow key={item.id} item={item} progressPct={progressPct} />;
    },
    [milestoneIndexMap, sortedMilestones, trainingDays],
  );

  const loading =
    pointsQuery.isLoading ||
    milestonesQuery.isLoading ||
    catalogQuery.isLoading ||
    redemptionsQuery.isLoading ||
    ledgerQuery.isLoading;

  const hasError =
    pointsQuery.isError ||
    milestonesQuery.isError ||
    catalogQuery.isError ||
    redemptionsQuery.isError ||
    ledgerQuery.isError ||
    scoreQuery.isError;
  const hasData =
    pointsQuery.data !== undefined ||
    milestonesQuery.data !== undefined ||
    catalogQuery.data !== undefined;

  const isInitialLoading = loading && !hasData;

  const scrollPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: scrollTopInset,
      paddingBottom: contentBottomInset,
    }),
    [scrollTopInset, inset.lg, contentBottomInset],
  );

  const errorMsg =
    pointsQuery.error instanceof Error
      ? pointsQuery.error.message
      : milestonesQuery.error instanceof Error
        ? milestonesQuery.error.message
        : catalogQuery.error instanceof Error
          ? catalogQuery.error.message
          : redemptionsQuery.error instanceof Error
            ? redemptionsQuery.error.message
            : ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : 'Please check your connection.';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['left', 'right']}
    >
      <View
        pointerEvents="box-none"
        style={[styles.floatingNav, { paddingTop: floatingNavTop, paddingHorizontal: inset.lg }]}
      >
        <View style={styles.floatingNavRow}>
          <GlassNavChrome
            onPress={() => {
              triggerLightImpact();
              router.back();
            }}
            accessibilityLabel="Go back"
            style={styles.floatingNavButton}
            contentStyle={styles.floatingNavButtonInner}
          >
            <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={UAE.ink} />
          </GlassNavChrome>

          <Animated.View pointerEvents="none" style={[styles.floatingNavTitleWrap, animatedHeaderTitleStyle]}>
            <Text
              numberOfLines={1}
              style={[typography.textPresets.bodyStrong, { color: colors.text.primary, textAlign: 'center' }]}
            >
              Rewards
            </Text>
          </Animated.View>

          <View style={styles.floatingNavSide} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, scrollPadding]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            progressViewOffset={scrollTopInset}
            tintColor={colors.accent.default}
          />
        }
      >
        <Animated.View style={animatedHeroStyle}>
          <RewardsSectionHeader />
        </Animated.View>

        {hasError && !hasData ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="error"
              title="Rewards unavailable"
              message={errorMsg}
              actionLabel="Retry"
              onAction={handleRefresh}
            />
          </View>
        ) : (
          <LoadingCrossfade isLoaded={!isInitialLoading} skeleton={<RewardsSkeleton />}>
            {hasError && hasData ? (
              <View style={{ marginBottom: 16 }}>
                <StateBlock
                  kind="error"
                  title="Rewards sync issue"
                  message="Some items or points balance could not be refreshed."
                  actionLabel="Retry"
                  onAction={handleRefresh}
                />
              </View>
            ) : null}

            {errorMessage ? (
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.status.error,
                    borderWidth: layout.borderWidth,
                    borderRadius: radius.card,
                  },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.status.error} />
                <Text style={[styles.errorText, { color: colors.status.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            <PointsBalanceCard
              balance={account.balance}
              tier={account.tier}
              lifetimePoints={account.lifetimePoints}
            />

            {loading && !isInitialLoading ? (
              <RewardsMilestonesSkeleton />
            ) : !loading ? (
              <>
                <RewardsSectionTitle title="Streak status" />
                <View style={[styles.insightRailWrap, { marginHorizontal: -inset.lg, marginBottom: gap.lg }]}>
                  <AppScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    contentContainerStyle={[
                      styles.insightRailContent,
                      { paddingHorizontal: inset.lg, gap: gap.md },
                    ]}
                  >
                    {streakInsights.map((insight) => (
                      <StreakInsightCard key={insight.id} insight={insight} />
                    ))}
                  </AppScrollView>
                </View>

                <RewardsSectionTitle title="Rewards Catalog" />
                <View style={[styles.catalogBlock, { marginBottom: gap.lg }]}>
                  {rewards.length > 0 ? (
                    <View style={styles.catalogGrid}>
                      {rewards.map((item) => (
                        <View key={item.id} style={styles.catalogCell}>
                          <RewardCatalogCard
                            item={item}
                            balance={account.balance}
                            tier={account.tier}
                            pendingRewardId={redeemMutation.isPending ? pendingRewardId : null}
                            readOnly={viewingChild}
                            onRedeem={handleRedeem}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <StateBlock
                      kind="empty"
                      title="No rewards available"
                      message="The academy catalog is empty right now."
                    />
                  )}
                </View>

                <RewardsSectionTitle title="Attendance milestones" />
                <View style={[styles.listBlock, { marginBottom: gap.lg }]}>
                  {sortedMilestones.length > 0 ? (
                    sortedMilestones.map(renderMilestone)
                  ) : (
                    <StateBlock
                      kind="empty"
                      title="No milestones configured"
                      message="Milestones will appear here after the academy publishes them."
                    />
                  )}
                </View>

                <RewardsSectionTitle title="Points activity" />
                <View style={[styles.listBlock, { marginBottom: gap.lg }]}>
                  {ledgerItems.length > 0 ? (
                    ledgerItems.map((item) => <PointsActivityRow key={item.id} item={item} />)
                  ) : (
                    <StateBlock
                      kind="empty"
                      title="No points activity yet"
                      message="Counted classes, milestone awards, and redemptions will appear here."
                    />
                  )}
                </View>

                <RewardsSectionTitle title="Redemption history" />
                <View style={styles.listBlock}>
                  {redemptionList.length > 0 ? (
                    <>
                      {redemptionList.map((item) => (
                        <RedemptionHistoryRow key={item.id} item={item} />
                      ))}
                    </>
                  ) : (
                    <StateBlock
                      kind="empty"
                      title="No redemptions yet"
                      message="Redeemed rewards will be grouped here by fulfillment status."
                    />
                  )}
                </View>
              </>
            ) : null}
          </LoadingCrossfade>
        )}
      </Animated.ScrollView>

      {isGuest ? (
        <PremiumLockOverlay
          title="Points & Rewards"
          description="Earn as you train. Activate your membership to unlock the points economy, complete milestones, and redeem rewards."
          topOffset={scrollTopInset}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  floatingNav: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  floatingNavRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingNavButton: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavButtonInner: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  floatingNavSide: {
    alignItems: 'flex-end',
    minWidth: NAV_CHROME.clusterHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  insightRailWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  insightRailContent: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  insightCard: {
    width: 280,
  },
  insightHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  insightIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  insightBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  insightBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  listBlock: {
    marginBottom: 16,
  },
  catalogBlock: {
    marginHorizontal: -6,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  catalogCell: {
    padding: 6,
    width: '50%',
  },
  redemptionStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
  },
  redemptionStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  redemptionStatusCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  redemptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  redemptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
  },
  redemptionContent: {
    flex: 1,
    gap: 3,
  },
  redemptionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  redemptionMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  redemptionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  redemptionStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ledgerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 14,
  },
  ledgerIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ledgerContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  ledgerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  ledgerDelta: {
    fontSize: 14,
    fontWeight: '900',
    minWidth: 58,
    textAlign: 'right',
  },
});
