import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { useAccountActionSheet } from '@/shared/hooks/useAccountActionSheet';

import { BeltPathAttendanceCard } from '@/features/belt/components/BeltPathAttendanceCard';
import { BeltPathHistoryCard } from '@/features/belt/components/BeltPathHistoryCard';
import { BeltPathPendingCard } from '@/features/belt/components/BeltPathPendingCard';
import { BeltPathRankSnapshot } from '@/features/belt/components/BeltPathRankSnapshot';
import { BeltPathRequirementCard } from '@/features/belt/components/BeltPathRequirementCard';
import { BeltPathSectionHeader } from '@/features/belt/components/BeltPathSectionHeader';
import { BeltPathSectionTitle } from '@/features/belt/components/BeltPathSectionTitle';
import { CurriculumAscentModule } from '@/features/belt/components/CurriculumAscentModule';
import { mapCurriculumRanksToAscentStops } from '@/features/belt/data/beltPathPreviewContent';
import { useBeltPath } from '@/features/belt/hooks/useBeltPath';
import { useRankEligibility, useMemberDisciplines } from '@/features/auth/hooks/useMemberDisciplines';
import { useDisciplineScore, useGym8WeeksActivity } from '@/features/home/hooks/useHomeDashboard';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { MotiEntrance, ScreenEntrance, LoadingCrossfade, BeltPathSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import {
  isOfflineWithoutCache,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import { useTheme } from '@/shared/theme';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';

const DEFAULT_8WEEKS_DATA = [0, 0, 0, 0, 0, 0, 0, 0];

export default function BeltPathScreen() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const topInset = useAppTopInset();
  const floatingNavTop = topInset + inset.xs;
  const floatingNavHeight = NAV_CHROME.clusterHeight;
  const scrollTopInset = floatingNavTop + floatingNavHeight + inset.sm;

  const rankEligibilityQuery = useRankEligibility();
  const memberDisciplinesQuery = useMemberDisciplines();

  const rankTrackDisciplines = useMemo(() => {
    return (memberDisciplinesQuery.data ?? []).filter(
      (d) => d.active && d.hasRankProgression
    );
  }, [memberDisciplinesQuery.data]);

  const [selectedDisciplineSlug, setSelectedDisciplineSlug] = useState<string | undefined>(undefined);

  const activeDisciplineSlug = selectedDisciplineSlug ?? rankEligibilityQuery.data?.disciplineSlug ?? 'bjj';

  const beltPathQuery = useBeltPath(activeDisciplineSlug);
  const scoreQuery = useDisciplineScore();
  const week8Query = useGym8WeeksActivity();
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const [refreshing, setRefreshing] = useState(false);
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

  const { isAnonymousGuest, needsActivation } = useIsGuest();
  const { prompt, sheet } = useAccountActionSheet();

  useFocusEffect(
    useCallback(() => {
      if (!needsActivation && !isAnonymousGuest) return;
      prompt('track-progress');
      const timer = setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }, 0);
      return () => clearTimeout(timer);
    }, [isAnonymousGuest, needsActivation, prompt, router]),
  );

  if (needsActivation || isAnonymousGuest) {
    return sheet;
  }

  const summary = beltPathQuery.data;
  const score = scoreQuery.data;
  const rankEligible = rankEligibilityQuery.data?.eligible === true;
  const rankEligibilityKnown = rankEligibilityQuery.data !== undefined;
  const showNotEligible = rankEligibilityKnown && !rankEligible;

  const hasError =
    rankEligibilityQuery.isError || beltPathQuery.isError || scoreQuery.isError || week8Query.isError;
  const hasData = summary !== undefined && summary !== null;
  const isInitialLoading =
    (rankEligibilityQuery.isLoading || (rankEligible && beltPathQuery.isLoading) || scoreQuery.isLoading) &&
    !hasData &&
    !showNotEligible;
  const errorMessage =
    beltPathQuery.error instanceof Error ? beltPathQuery.error.message : 'Please check your connection.';
  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });

  const onRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await Promise.all([
        rankEligibilityQuery.refetch(),
        memberDisciplinesQuery.refetch(),
        beltPathQuery.refetch(),
        scoreQuery.refetch(),
        week8Query.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [beltPathQuery, memberDisciplinesQuery, rankEligibilityQuery, scoreQuery, week8Query]);

  const scrollPadding = useMemo(
    () => ({
      paddingTop: scrollTopInset,
      paddingBottom: contentBottomInset,
      paddingHorizontal: inset.lg,
    }),
    [scrollTopInset, contentBottomInset, inset.lg],
  );

  const weeksData = useMemo(() => week8Query.data ?? DEFAULT_8WEEKS_DATA, [week8Query.data]);
  const shouldShowCurriculumPending = summary?.isPlaceholderCurriculum === true;
  const curriculumStops = useMemo(() => {
    if (!summary?.curriculumRanks?.length) {
      return [];
    }
    return mapCurriculumRanksToAscentStops(summary.curriculumRanks);
  }, [summary?.curriculumRanks]);

  const trainingDaysForRequirements = summary?.progress.trainingDays ?? 0;

  const requirementsState = useMemo(() => {
    if (!summary) {
      return {
        showPending: false,
        showPromotionReady: false,
        items: [],
      };
    }

    const targetStripeRequirements = summary.requirements.filter(
      (item) => item.stripe === summary.targetStripe,
    );
    const targetStripeComplete =
      targetStripeRequirements.length > 0 &&
      targetStripeRequirements.every((item) => item.status === 'done');
    const atMaxStripe = summary.progress.stripe >= summary.progress.maxStripes;

    return {
      showPending: !summary.hasConfiguredRequirements && !shouldShowCurriculumPending,
      showPromotionReady:
        summary.hasConfiguredRequirements && atMaxStripe && targetStripeComplete,
      items: summary.requirements,
    };
  }, [shouldShowCurriculumPending, summary]);

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
              Belt Path
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
            onRefresh={onRefresh}
            progressViewOffset={scrollTopInset}
            tintColor={colors.accent.default}
          />
        }
      >
        <Animated.View style={animatedHeroStyle}>
          <BeltPathSectionHeader />
        </Animated.View>

        {isOfflineBlocked ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="error"
              title={OFFLINE_TITLE}
              message={OFFLINE_MESSAGE}
              actionLabel="Retry"
              onAction={onRefresh}
              offlineAwareRetry
            />
          </View>
        ) : hasError && hasData ? (
          <View style={{ marginBottom: gap.md }}>
            <StateBlock
              kind="error"
              title="Sync issue"
              message="Some metrics could not be refreshed."
              actionLabel="Retry"
              onAction={onRefresh}
              offlineAwareRetry
            />
          </View>
        ) : null}

        {!isOfflineBlocked && showNotEligible ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="empty"
              title="Rank path is not active"
              message="Formal rank progression is shown for BJJ and Wrestling memberships."
              actionLabel="Back"
              onAction={() => router.back()}
            />
          </View>
        ) : !isOfflineBlocked && hasError && !hasData ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="error"
              title="Unable to load belt path"
              message={errorMessage}
              actionLabel="Retry"
              onAction={onRefresh}
              offlineAwareRetry
            />
          </View>
        ) : !isOfflineBlocked ? (
          <LoadingCrossfade isLoaded={!isInitialLoading} skeleton={<BeltPathSkeleton />}>
            {summary ? (
              <>
                {rankTrackDisciplines.length > 1 ? (
                  <View style={[styles.switcherContainer, { backgroundColor: colors.fill.secondary, borderRadius: radius.pill, padding: 4, flexDirection: 'row', marginBottom: gap.md }]}>
                    {rankTrackDisciplines.map((d) => {
                      const isActive = d.slug === activeDisciplineSlug;
                      return (
                        <TouchableOpacity
                          key={d.slug}
                          onPress={() => {
                            triggerLightImpact();
                            setSelectedDisciplineSlug(d.slug);
                          }}
                          style={[
                            styles.switcherButton,
                            {
                              flex: 1,
                              backgroundColor: isActive ? colors.surface.primary : 'transparent',
                              borderRadius: radius.pill,
                              paddingVertical: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: isActive ? 1 : 0 },
                              shadowOpacity: isActive ? 0.08 : 0,
                              shadowRadius: isActive ? 2 : 0,
                              elevation: isActive ? 1 : 0,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              typography.textPresets.bodyStrong,
                              {
                                fontSize: 13,
                                color: isActive ? colors.text.primary : colors.text.secondary,
                              },
                            ]}
                          >
                            {d.displayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {shouldShowCurriculumPending || curriculumStops.length === 0 ? (
                  <BeltPathRankSnapshot progress={summary.progress} />
                ) : (
                  <CurriculumAscentModule
                    currentRankName={summary.progress.rankName}
                    currentRankId={summary.progress.rankId}
                    stops={curriculumStops}
                  />
                )}

                <ScreenEntrance>
                  <MotiEntrance index={0}>
                    <BeltPathAttendanceCard
                      trainingDays30d={score?.trainingDays30d ?? 0}
                      currentStreak={score?.currentStreak ?? 0}
                      totalTrainingDays={score?.trainingDays ?? 0}
                      weekCounts={weeksData}
                    />
                  </MotiEntrance>
                </ScreenEntrance>

                <View style={[styles.section, { gap: gap.sm }]}>
                  <BeltPathSectionTitle title="Requirements" />
                  <View style={[styles.list, { gap: gap.sm }]}>
                    {requirementsState.showPending ? (
                      <BeltPathPendingCard
                        icon="list-outline"
                        title={`${summary.progress.rankName} requirements not published yet`}
                        message="Stripe requirements for this rank are not in the app yet. Keep training — your attendance and streaks still count toward progress."
                      />
                    ) : requirementsState.showPromotionReady ? (
                      <BeltPathPendingCard
                        icon="ribbon-outline"
                        title="Ready for promotion review"
                        message="You have completed all stripe requirements for this rank. Your coach will review you for the next promotion."
                      />
                    ) : (
                      requirementsState.items.map((item) => (
                        <BeltPathRequirementCard
                          key={item.id}
                          item={item}
                          trainingDays={trainingDaysForRequirements}
                        />
                      ))
                    )}
                  </View>
                </View>

                <View style={[styles.section, { gap: gap.sm }]}>
                  <BeltPathSectionTitle title="Promotion history" />
                  <BeltPathHistoryCard promotions={summary.promotions} />
                </View>
              </>
            ) : null}
          </LoadingCrossfade>
        ) : null}

        {beltPathQuery.isFetching && !beltPathQuery.isLoading ? (
          <ActivityIndicator style={styles.refreshLoader} color={colors.accent.default} />
        ) : null}
      </Animated.ScrollView>
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
  section: {
    marginBottom: 4,
  },
  list: {
    marginBottom: 16,
  },
  refreshLoader: { marginTop: 16 },
  switcherContainer: {
    alignSelf: 'stretch',
  },
  switcherButton: {
    flex: 1,
  },
});
