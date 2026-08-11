import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { HomeDashboardSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import {
  useHomeDashboardSummary,
  useMemberPercentileRank,
} from '@/features/home/hooks/useHomeDashboard';
import { Ionicons } from '@expo/vector-icons';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';
import { useScheduleDay, useScheduleFocusSync } from '@/features/schedule/hooks/useSchedule';
import {
  HOME_HERO_CLASS_LIMIT,
  resolveHomeHeroClasses,
} from '@/services/database/classes.repository';
import { useTheme } from '@/shared/theme';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { HeroClassCard } from '@/features/home/components/HeroClassCard';
import { DisciplineHero } from '@/features/home/components/DisciplineHero';
import { HomeQuickActions } from '@/features/home/components/HomeQuickActions';
import { HomeBeltPathCard } from '@/features/home/components/HomeBeltPathCard';
import { HomeCoachPreview } from '@/features/home/components/HomeCoachPreview';
import { HomeScreenHeader } from '@/features/home/components/HomeScreenHeader';
import { HomeSectionTitle } from '@/features/home/components/HomeSectionTitle';
import { HomeSyncBanner } from '@/features/home/components/HomeSyncBanner';
import {
  AnimatedAppScrollView,
  HomeAnimatedSection,
} from '@/features/home/components/HomeAnimatedSection';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { isOfflineWithoutCache, OFFLINE_MESSAGE, OFFLINE_TITLE } from '@/lib/offlineState';
import { useHomeTabEntrance } from '@/features/home/hooks/useHomeTabEntrance';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';

function getGymDateKey(date: Date): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dubaiTime = new Date(utc + 3600000 * 4);
  const y = dubaiTime.getFullYear();
  const m = (dubaiTime.getMonth() + 1).toString().padStart(2, '0');
  const d = dubaiTime.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomeScreen() {
  const { colors, inset, layout, gap } = useTheme();
  usePerfRouteMount(PerfMark.routeHomeMount);
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();

  const dashboardQuery = useHomeDashboardSummary();
  const percentileQuery = useMemberPercentileRank();
  const coachesQuery = useCoaches();
  const scheduleDayQuery = useScheduleDay();
  const { sync: syncScheduleMirror } = useScheduleFocusSync();
  const { isOnline, networkStatusKnown } = useNetworkStatus();
  const { hasLimitedAccess, isAnonymousGuest } = useIsGuest();
  const viewingChild = useIsViewingChildProfile();

  const consistencyRank = useMemo(() => {
    const topPercent = percentileQuery.data;
    if (topPercent == null || topPercent <= 0) return '—';
    return `Top ${topPercent}%`;
  }, [percentileQuery.data]);

  const { entranceSignal, replayKey } = useHomeTabEntrance();
  const [refreshing, setRefreshing] = useState(false);

  const dashboard = dashboardQuery.data;
  const memberUpcoming = useMemo(
    () => dashboard?.upcomingClasses ?? [],
    [dashboard?.upcomingClasses],
  );
  const upcoming = useMemo(() => {
    const schedulePool = scheduleDayQuery.data ?? [];
    // Merge pools so Gym Usage can lead and remaining slots fill from the full day schedule.
    const byId = new Map<string, (typeof memberUpcoming)[number]>();
    for (const item of memberUpcoming) byId.set(item.id, item);
    for (const item of schedulePool) byId.set(item.id, item);
    const pool = byId.size > 0 ? [...byId.values()] : memberUpcoming;
    return resolveHomeHeroClasses(pool, HOME_HERO_CLASS_LIMIT);
  }, [memberUpcoming, scheduleDayQuery.data]);

  const heroClass = upcoming[0] ?? null;

  const onRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      if (!viewingChild) {
        await syncScheduleMirror(true);
      }
      await Promise.all([
        dashboardQuery.refetch(),
        percentileQuery.refetch(),
        coachesQuery.refetch(),
        !viewingChild ? scheduleDayQuery.refetch() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    coachesQuery,
    dashboardQuery,
    scheduleDayQuery,
    syncScheduleMirror,
    viewingChild,
    percentileQuery,
  ]);

  const isToday = useMemo(() => {
    if (!heroClass) return false;
    const todayStr = getGymDateKey(new Date());
    const classStr = getGymDateKey(new Date(heroClass.startsAt));
    return todayStr === classStr;
  }, [heroClass]);

  const beltProgress = dashboard?.beltProgress ?? null;
  const rankEligible = dashboard?.rankEligibility.eligible === true;
  const hasBeltProgress = rankEligible && Boolean(beltProgress);
  const progressStripe = hasBeltProgress ? (beltProgress?.stripe ?? 0) : 0;
  const rankName = hasBeltProgress ? (beltProgress?.rankName ?? 'White') : 'Curriculum pending';
  const stripeProgressPercent = hasBeltProgress ? (beltProgress?.percent ?? 0) : 0;
  const sessionsToNext = hasBeltProgress
    ? 12 - ((dashboard?.disciplineScore.trainingDays ?? 0) % 12)
    : 0;
  const nextStripeNum = progressStripe < 4 ? progressStripe + 1 : 4;
  const formattedBeltRank = rankName.toLowerCase().includes('belt') ? rankName : `${rankName} Belt`;

  const coachPreview = useMemo(() => (coachesQuery.data ?? []).slice(0, 5), [coachesQuery.data]);

  const handleCoachPress = useCallback(
    (id: string) => router.push(`/coaches/${id}?origin=coaches`),
    [router],
  );

  const hasError = dashboardQuery.isError;

  const hasData =
    dashboard !== undefined ||
    coachesQuery.data !== undefined ||
    (!viewingChild &&
      (upcoming.length > 0 || (isAnonymousGuest && scheduleDayQuery.data !== undefined)));

  const isInitialLoading =
    !hasData &&
    (dashboardQuery.isLoading || (!viewingChild && isAnonymousGuest && scheduleDayQuery.isLoading));

  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });

  usePerfOnceReady(PerfMark.routeHomeFirstContent, !isInitialLoading && hasData);

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;
  const sectionScrollProps = useMemo(
    () => ({
      entranceSignal,
      replayKey,
    }),
    [entranceSignal, replayKey],
  );
  const screenPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
      gap: gap.lg,
    }),
    [contentBottomInset, gap.lg, inset.lg, screenPaddingTop],
  );

  const eyebrowLabel = viewingChild
    ? 'Child progress'
    : hasLimitedAccess
      ? 'Welcome to the Academy'
      : isToday
        ? 'Tonight at the academy'
        : 'Next at the academy';

  if (isOfflineBlocked) {
    return (
      <View
        style={[
          styles.safe,
          {
            backgroundColor: colors.background.primary,
            justifyContent: 'center',
            padding: inset.lg,
          },
        ]}
      >
        <StateBlock
          kind="error"
          title={OFFLINE_TITLE}
          message={OFFLINE_MESSAGE}
          actionLabel="Retry"
          onAction={onRefresh}
          offlineAwareRetry
        />
      </View>
    );
  }

  if (hasError && !hasData) {
    return (
      <View
        style={[
          styles.safe,
          {
            backgroundColor: colors.background.primary,
            justifyContent: 'center',
            padding: inset.lg,
          },
        ]}
      >
        <StateBlock
          kind="error"
          title="Could not load dashboard"
          message="Please check your connection and try again."
          actionLabel="Retry"
          onAction={onRefresh}
          offlineAwareRetry
        />
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <View style={screenPadding}>
          <HomeDashboardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <AnimatedAppScrollView
        contentContainerStyle={screenPadding}
        showsHorizontalScrollIndicator={false}
        alwaysBounceHorizontal={false}
        directionalLockEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {hasError && hasData ? <HomeSyncBanner onRetry={onRefresh} /> : null}

        <HomeAnimatedSection index={0} motion="heroCopy" {...sectionScrollProps}>
          <HomeScreenHeader eyebrowLabel={eyebrowLabel} />
        </HomeAnimatedSection>

        {!viewingChild ? (
          <HomeAnimatedSection index={1} motion="heroCard" {...sectionScrollProps}>
            <HeroClassCard
              classes={upcoming}
              onClassPress={(id) => router.push(`/classes/${id}`)}
              onOpenSchedule={() => router.push('/(tabs)/schedule')}
            />
          </HomeAnimatedSection>
        ) : null}

        {!hasLimitedAccess ? (
          <HomeAnimatedSection index={2} {...sectionScrollProps}>
            <DisciplineHero
              score={dashboard?.disciplineScore}
              weekActivity={dashboard?.weekActivity}
            />
          </HomeAnimatedSection>
        ) : null}

        {!hasLimitedAccess && viewingChild ? (
          <HomeAnimatedSection index={3} {...sectionScrollProps}>
            <View style={[styles.perfCardsGrid, { gap: 12 }]}>
              {/* Row 1 */}
              <View style={styles.perfCardsRow}>
                {/* Card 1: Training Volume */}
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      borderWidth: layout.borderWidth,
                    },
                  ]}
                >
                  {/* Barbell Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="barbell-outline"
                      size={80}
                      color={colors.text.primary}
                      style={{ opacity: 0.05, transform: [{ rotate: '-15deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Training Volume
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {dashboard?.disciplineScore.trainingDays ?? 0}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Classes Completed
                  </Text>
                </View>

                {/* Card 2: Consistency */}
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      borderWidth: layout.borderWidth,
                    },
                  ]}
                >
                  {/* Trending Up Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="trending-up-outline"
                      size={80}
                      color={colors.text.primary}
                      style={{ opacity: 0.05, transform: [{ rotate: '-10deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Consistency
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: '#00843D' }]}>
                    {consistencyRank}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Attendance Rank
                  </Text>
                </View>
              </View>

              {/* Row 2 */}
              <View style={styles.perfCardsRow}>
                {/* Card 3: Current Streak */}
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      borderWidth: layout.borderWidth,
                    },
                  ]}
                >
                  {/* Flame Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="flame-outline"
                      size={80}
                      color={colors.text.primary}
                      style={{ opacity: 0.05, transform: [{ rotate: '-12deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Current Streak
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {dashboard?.disciplineScore.currentStreak ?? 0}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Day Streak
                  </Text>
                </View>

                {/* Card 4: Points Balance */}
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      borderWidth: layout.borderWidth,
                    },
                  ]}
                >
                  {/* Diamond Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="diamond-outline"
                      size={80}
                      color={colors.text.primary}
                      style={{ opacity: 0.05, transform: [{ rotate: '-8deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Points Balance
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {Number(dashboard?.points.balance ?? 0).toLocaleString()}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Points Balance
                  </Text>
                </View>
              </View>
            </View>
          </HomeAnimatedSection>
        ) : null}

        {!hasLimitedAccess ? (
          <HomeAnimatedSection index={4} {...sectionScrollProps}>
            <HomeSectionTitle title={viewingChild ? 'Check-in' : 'Quick access'} />
            <HomeQuickActions
              pointsBalance={Number(dashboard?.points.balance ?? 0)}
              onOpenCheckIn={() => router.push('/(tabs)/checkin')}
              onOpenRewards={() => router.push('/(tabs)/rewards')}
              showRewards={true}
              qrSubtitle={
                viewingChild
                  ? 'Open check-in status and visit history'
                  : 'Tap to open your check-in code'
              }
            />
          </HomeAnimatedSection>
        ) : null}

        {!hasLimitedAccess && rankEligible ? (
          <HomeAnimatedSection index={5} {...sectionScrollProps}>
            <HomeBeltPathCard
              hasBeltProgress={hasBeltProgress}
              formattedBeltRank={formattedBeltRank}
              progressStripe={progressStripe}
              stripeProgressPercent={stripeProgressPercent}
              sessionsToNext={sessionsToNext}
              nextStripeNum={nextStripeNum}
              onPress={() => router.push('/(tabs)/belt-path')}
            />
          </HomeAnimatedSection>
        ) : null}

        {!viewingChild ? (
          <HomeAnimatedSection index={6} {...sectionScrollProps}>
            <HomeCoachPreview
              coaches={coachPreview}
              onCoachPress={handleCoachPress}
              onSeeAll={() => router.push('/(tabs)/coaches')}
            />
          </HomeAnimatedSection>
        ) : null}
      </AnimatedAppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  perfCardsGrid: {
    width: '100%',
  },
  perfCardsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
    borderRadius: 32,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
      },
    }),
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    zIndex: 0,
  },
  perfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  perfCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  perfCardValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 4,
    zIndex: 1,
  },
  perfCardSub: {
    fontSize: 12,
    fontWeight: '500',
    zIndex: 1,
  },
});
