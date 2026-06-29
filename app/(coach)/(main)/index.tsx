import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { CoachDashboardSkeleton } from '@/shared/animations';
import { useTabEntranceReplay } from '@/shared/navigation/useTabEntranceReplay';
import { CoachNowTeachingCard } from '@/features/coach/components/home/CoachNowTeachingCard';
import { CoachGroupsPreview } from '@/features/coach/components/home/CoachGroupsPreview';
import { CoachTodayClassRow } from '@/features/coach/components/home/CoachTodayClassRow';
import {
  useCoachClasses,
  useCoachDashboardStats,
  useCurrentCoachClass,
} from '@/features/coach/hooks/useCoachMode';
import {
  AnimatedAppScrollView,
  HomeAnimatedSection,
} from '@/features/home/components/HomeAnimatedSection';
import { HomeScreenHeader } from '@/features/home/components/HomeScreenHeader';
import { HomeSectionTitle } from '@/features/home/components/HomeSectionTitle';
import { HomeSyncBanner } from '@/features/home/components/HomeSyncBanner';
import { isGymToday } from '@/core/time/gymTime';
import { useRollCallState } from '@/features/coach/roll-call/hooks/useRollCall';
import { coachHeroAttendanceStats } from '@/features/coach/roll-call/utils/rollCallNavigation';
import { triggerLightImpact } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';

const COACH_TITLE_LINES = [
  [{ text: 'Run class ' }, { text: 'in seconds.', accent: true }],
];

export default function CoachHomeScreen() {
  const { colors, inset, layout, gap } = useTheme();
  usePerfRouteMount(PerfMark.routeCoachHomeMount);
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();

  const statsQuery = useCoachDashboardStats();
  const { current } = useCurrentCoachClass();
  const classesQuery = useCoachClasses();

  const [refreshing, setRefreshing] = useState(false);
  const entranceReplayKey = useTabEntranceReplay();

  const todayClasses = useMemo(
    () => (classesQuery.data ?? []).filter((item) => isGymToday(item.startsAt)),
    [classesQuery.data],
  );

  const heroClass = current ?? todayClasses[0] ?? null;
  const rollCallQuery = useRollCallState(heroClass?.id ?? null);

  const rosterStats = useMemo(
    () =>
      rollCallQuery.data?.rosterAttendance ?? {
        checkedIn: 0,
        missing: 0,
      },
    [rollCallQuery.data?.rosterAttendance],
  );

  const heroAttendance = useMemo(
    () =>
      coachHeroAttendanceStats(
        rollCallQuery.data?.summary,
        rollCallQuery.data?.session ?? null,
        rosterStats,
      ),
    [rollCallQuery.data?.session, rollCallQuery.data?.summary, rosterStats],
  );

  const openHeroClass = useCallback(() => {
    if (!heroClass) return;
    router.push(`/(coach)/run-class/${heroClass.id}`);
  }, [heroClass, router]);

  const promoteCount = statsQuery.data?.promotionCandidateCount ?? 0;

  const hasError = statsQuery.isError || classesQuery.isError;
  const hasData =
    statsQuery.data !== undefined ||
    classesQuery.data !== undefined ||
    todayClasses.length > 0;

  const isInitialLoading = !hasData && (statsQuery.isLoading || classesQuery.isLoading);

  usePerfOnceReady(PerfMark.routeCoachHomeFirstContent, !isInitialLoading && (hasData || hasError));

  const errorMessage =
    statsQuery.error instanceof Error
      ? statsQuery.error.message
      : classesQuery.error instanceof Error
        ? classesQuery.error.message
        : 'Please check your connection.';

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await Promise.all([
        statsQuery.refetch(),
        classesQuery.refetch(),
        rollCallQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [classesQuery, rollCallQuery, statsQuery]);

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const screenPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
      gap: gap.lg,
    }),
    [contentBottomInset, gap.lg, inset.lg, screenPaddingTop],
  );

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
          message={errorMessage}
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <View style={screenPadding}>
          <CoachDashboardSkeleton />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {hasError && hasData ? <HomeSyncBanner onRetry={handleRefresh} /> : null}

        <HomeAnimatedSection index={0} replayKey={entranceReplayKey} motion="heroCopy">
          <HomeScreenHeader
            eyebrowLabel="Coach mode"
            showFlag={false}
            collapseOnWide={false}
            titleLines={COACH_TITLE_LINES}
          />
        </HomeAnimatedSection>

        <HomeAnimatedSection index={1} replayKey={entranceReplayKey} motion="heroCard">
          <CoachNowTeachingCard
            classItem={heroClass}
            presentCount={heroAttendance.presentCount}
            missingCount={heroAttendance.missingCount}
            promoteCount={promoteCount}
            statsLoading={Boolean(heroClass) && rollCallQuery.isLoading}
            presentLabel={heroAttendance.usesRollCall ? 'PRESENT' : 'CHECKED IN'}
            onPress={openHeroClass}
          />
        </HomeAnimatedSection>

        <HomeAnimatedSection index={2} replayKey={entranceReplayKey}>
          <CoachGroupsPreview />
        </HomeAnimatedSection>

        <HomeAnimatedSection index={3} replayKey={entranceReplayKey}>
          <HomeSectionTitle
            title="Today's schedule"
            actionLabel="See all →"
            onAction={() => router.push('/(coach)/(main)/classes')}
            actionAccessibilityLabel="See all classes"
          />

          {classesQuery.error ? (
            <StateBlock
              kind="error"
              title="Could not load classes"
              message={
                classesQuery.error instanceof Error
                  ? classesQuery.error.message
                  : 'Please check your connection.'
              }
              actionLabel="Retry"
              onAction={() => classesQuery.refetch()}
            />
          ) : todayClasses.length === 0 ? (
            <StateBlock
              kind="empty"
              title="No classes today"
              message="Your schedule will appear here."
            />
          ) : (
            todayClasses.slice(0, 5).map((item) => (
              <CoachTodayClassRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/(coach)/run-class/${item.id}`)}
              />
            ))
          )}
        </HomeAnimatedSection>
      </AnimatedAppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
