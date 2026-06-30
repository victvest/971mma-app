import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { HomeDashboardSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { useHomeDashboardSummary } from '@/features/home/hooks/useHomeDashboard';
import { useScheduleFocusSync } from '@/features/schedule/hooks/useSchedule';
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
import {
  isOfflineWithoutCache,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import { useHomeTabEntrance } from '@/features/home/hooks/useHomeTabEntrance';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';

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
  const { sync: syncScheduleMirror } = useScheduleFocusSync();
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const { entranceSignal, coverStyle: entranceCoverStyle } = useHomeTabEntrance();
  const [refreshing, setRefreshing] = useState(false);

  const dashboard = dashboardQuery.data;
  const upcoming = dashboard?.upcomingClasses ?? [];

  const heroClass = upcoming[0] ?? null;

  const onRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await syncScheduleMirror(true);
      await dashboardQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [dashboardQuery, syncScheduleMirror]);

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
  const rankName = hasBeltProgress
    ? (beltProgress?.rankName ?? 'White')
    : 'Curriculum pending';
  const stripeProgressPercent = hasBeltProgress ? (beltProgress?.percent ?? 0) : 0;
  const sessionsToNext = hasBeltProgress
    ? 12 - ((dashboard?.disciplineScore.trainingDays ?? 0) % 12)
    : 0;
  const nextStripeNum = progressStripe < 4 ? progressStripe + 1 : 4;
  const formattedBeltRank = rankName.toLowerCase().includes('belt') ? rankName : `${rankName} Belt`;

  const coachPreview = dashboard?.coachPreview ?? [];

  const handleCoachPress = useCallback(
    (id: string) => router.push(`/coaches/${id}?origin=coaches`),
    [router],
  );

  const hasError = dashboardQuery.isError;

  const hasData =
    upcoming.length > 0 ||
    coachPreview.length > 0 ||
    dashboard !== undefined;

  const isInitialLoading = !hasData && dashboardQuery.isLoading;

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
    }),
    [entranceSignal],
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

  const { hasLimitedAccess } = useIsGuest();
  const eyebrowLabel = hasLimitedAccess ? 'Welcome to the Academy' : (isToday ? 'Tonight at the academy' : 'Next at the academy');

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

        {upcoming.length > 0 ? (
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

        {!hasLimitedAccess ? (
          <HomeAnimatedSection index={3} {...sectionScrollProps}>
            <HomeSectionTitle title="Quick access" />
            <HomeQuickActions
              pointsBalance={Number(dashboard?.points.balance ?? 0)}
              onOpenCheckIn={() => router.push('/(tabs)/checkin')}
              onOpenRewards={() => router.push('/(tabs)/rewards')}
            />
          </HomeAnimatedSection>
        ) : null}

        {!hasLimitedAccess && rankEligible ? (
          <HomeAnimatedSection index={4} {...sectionScrollProps}>
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

        <HomeAnimatedSection index={5} {...sectionScrollProps}>
          <HomeCoachPreview
            coaches={coachPreview}
            onCoachPress={handleCoachPress}
            onSeeAll={() => router.push('/(tabs)/coaches')}
          />
        </HomeAnimatedSection>
      </AnimatedAppScrollView>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.entranceCover,
          { backgroundColor: colors.background.primary },
          entranceCoverStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  entranceCover: {
    ...StyleSheet.absoluteFill,
    zIndex: 850,
  },
});
