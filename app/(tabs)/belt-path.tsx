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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BeltPathAttendanceCard } from '@/features/belt/components/BeltPathAttendanceCard';
import { BeltPathChallengeCard } from '@/features/belt/components/BeltPathChallengeCard';
import { BeltPathHistoryCard } from '@/features/belt/components/BeltPathHistoryCard';
import { BeltPathRequirementCard } from '@/features/belt/components/BeltPathRequirementCard';
import { BeltPathSectionHeader } from '@/features/belt/components/BeltPathSectionHeader';
import { BeltPathSectionTitle } from '@/features/belt/components/BeltPathSectionTitle';
import { CurriculumAscentModule } from '@/features/belt/components/CurriculumAscentModule';
import {
  BELT_PATH_PREVIEW_CHALLENGES,
  BELT_PATH_PREVIEW_PROMOTIONS,
  BELT_PATH_PREVIEW_REQUIREMENTS,
} from '@/features/belt/data/beltPathPreviewContent';
import { useBeltPath } from '@/features/belt/hooks/useBeltPath';
import { useRankEligibility, useMemberDisciplines } from '@/features/auth/hooks/useMemberDisciplines';
import { useDisciplineScore, useGym8WeeksActivity } from '@/features/home/hooks/useHomeDashboard';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { MotiEntrance, ScreenEntrance, LoadingCrossfade, BeltPathSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { ActiveProfileBanner } from '@/features/guardian/components/ActiveProfileBanner';
import type { BeltRequirementItem, PromotionItem } from '@/types/domain';

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

  const displayRequirements = useMemo((): BeltRequirementItem[] => {
    if (!summary || shouldShowCurriculumPending || summary.requirements.length === 0) {
      return BELT_PATH_PREVIEW_REQUIREMENTS;
    }
    return summary.requirements;
  }, [summary, shouldShowCurriculumPending]);

  const displayPromotions = useMemo((): PromotionItem[] => {
    if (!summary || summary.promotions.length === 0) {
      return BELT_PATH_PREVIEW_PROMOTIONS;
    }
    return summary.promotions;
  }, [summary]);

  const trainingDaysForRequirements = summary?.progress.trainingDays ?? 0;

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

        <ActiveProfileBanner />

        {hasError && hasData ? (
          <View style={{ marginBottom: gap.md }}>
            <StateBlock
              kind="error"
              title="Sync issue"
              message="Some metrics could not be refreshed."
              actionLabel="Retry"
              onAction={onRefresh}
            />
          </View>
        ) : null}

        {showNotEligible ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="empty"
              title="Rank path is not active"
              message="Formal rank progression is shown for BJJ and Wrestling memberships."
              actionLabel="Back"
              onAction={() => router.back()}
            />
          </View>
        ) : hasError && !hasData ? (
          <View style={{ marginTop: 40 }}>
            <StateBlock
              kind="error"
              title="Unable to load belt path"
              message={errorMessage}
              actionLabel="Retry"
              onAction={onRefresh}
            />
          </View>
        ) : (
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

                {shouldShowCurriculumPending ? (
                  <View style={[styles.pendingSection, { gap: gap.sm, marginBottom: gap.lg }]}>
                    <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
                      Curriculum pending
                    </Text>
                  </View>
                ) : (
                  <CurriculumAscentModule currentRankName={summary.progress.rankName} />
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
                    {shouldShowCurriculumPending ? (
                      <View style={{ padding: inset.md, alignItems: 'center' }}>
                        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
                          Requirements pending
                        </Text>
                      </View>
                    ) : (
                      displayRequirements.map((item) => (
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
                  <BeltPathSectionTitle title="Challenges" />
                  <View style={[styles.list, { gap: gap.sm }]}>
                    {BELT_PATH_PREVIEW_CHALLENGES.map((item) => (
                      <BeltPathChallengeCard key={item.id} item={item} />
                    ))}
                  </View>
                </View>

                <View style={[styles.section, { gap: gap.sm }]}>
                  <BeltPathSectionTitle title="Promotion history" />
                  <BeltPathHistoryCard promotions={displayPromotions} />
                </View>
              </>
            ) : null}
          </LoadingCrossfade>
        )}

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
  pendingSection: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
