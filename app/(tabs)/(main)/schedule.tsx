import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { gymRangeIso, gymTodayTomorrowRange } from '@/core/time/gymTime';
import { LoadingCrossfade, ScheduleSkeleton, SkeletonRect } from '@/shared/animations';
import { animations } from '@/shared/theme/animations';
import { ScrollRevealCard } from '@/shared/animations/ScrollRevealCard';
import { ScheduleClassCard } from '@/features/schedule/components/ScheduleClassCard';
import { ScheduleEmptyState } from '@/features/schedule/components/ScheduleEmptyState';
import { ScheduleFilterBar } from '@/features/schedule/components/ScheduleFilterBar';
import { ScheduleListRow } from '@/features/schedule/components/ScheduleListRow';
import { ScheduleSectionHeader } from '@/features/schedule/components/ScheduleSectionHeader';
import {
  forceScheduleRefresh,
  schedulePagesKey,
  useScheduleCategories,
  useScheduleFocusSync,
  useScheduleMirrorInvalidation,
  useSchedulePages,
  useScheduleRefresh,
} from '@/features/schedule/hooks/useSchedule';
import {
  isScheduleCategory,
  scheduleCategoryLabel,
  type ScheduleCategory,
} from '@/features/schedule/utils/scheduleCategory';
import { useTheme } from '@/shared/theme';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import {
  isOfflineWithoutCache,
  isQueryActivelyLoading,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import type { ClassItem } from '@/types/domain';
import { useMemberDisciplines } from '@/features/auth/hooks/useMemberDisciplines';

// ─── Row props ────────────────────────────────────────────────────────────────
type ClassRowProps = {
  item: ClassItem;
  index: number;
  entranceSignal: SharedValue<number>;
  onPressId: (id: string) => void;
  isEnrolled?: boolean;
};

const ClassRow = memo(function ClassRow({
  item,
  index,
  entranceSignal,
  onPressId,
  isEnrolled = false,
}: ClassRowProps) {
  const handlePress = useCallback(() => onPressId(item.id), [item.id, onPressId]);
  return (
    <ScrollRevealCard itemId={item.id} index={index} entranceSignal={entranceSignal}>
      <ScheduleListRow accessibilityLabel={item.title} onPress={handlePress}>
        <ScheduleClassCard item={item} embedded isEnrolled={isEnrolled} />
      </ScheduleListRow>
    </ScrollRevealCard>
  );
});

type ScheduleHeaderMotionProps = {
  children: React.ReactNode;
  index: number;
  replayKey: number;
  motion?: 'title' | 'filters';
};

function ScheduleHeaderMotion({
  children,
  index,
  replayKey,
}: ScheduleHeaderMotionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(38);

  useEffect(() => {
    const delay = Math.min(index, 4) * animations.stagger.base;
    opacity.value = 0;
    translateY.value = 42;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [index, opacity, replayKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const { colors, inset, layout, radius } = useTheme();
  usePerfRouteMount(PerfMark.routeScheduleMount);
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ScheduleCategory | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);
  const todayRange = gymTodayTomorrowRange();
  const rangeIso = gymRangeIso();

  const { replayKey: entranceReplayKey, entranceSignal } = useTabEntrance();

  // ── Data hooks ──────────────────────────────────────────────────────────
  const categoriesQuery = useScheduleCategories();
  const refreshQuery = useScheduleRefresh(todayRange);
  const scheduleQuery = useSchedulePages(category);
  const { sync: syncScheduleMirror } = useScheduleFocusSync();

  useScheduleMirrorInvalidation(
    refreshQuery.data,
    refreshQuery.dataUpdatedAt,
    refreshQuery.isSuccess,
  );

  const filterOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((value) => ({
        value,
        label: scheduleCategoryLabel(value),
      })),
    [categoriesQuery.data],
  );

  useEffect(() => {
    if (!category) return;
    if (filterOptions.length > 0 && !filterOptions.some((option) => option.value === category)) {
      setCategory(null);
    }
  }, [category, filterOptions]);

  useEffect(() => {
    loadingMoreRef.current = false;
  }, [category]);

  const handleRetry = useCallback(async () => {
    await forceScheduleRefresh(todayRange);
    await queryClient.invalidateQueries({
      queryKey: schedulePagesKey({ ...rangeIso, category }),
    });
    await Promise.all([refreshQuery.refetch(), scheduleQuery.refetch()]);
  }, [todayRange, rangeIso, category, queryClient, refreshQuery, scheduleQuery]);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await syncScheduleMirror(true);
      await Promise.all([refreshQuery.refetch(), scheduleQuery.refetch(), categoriesQuery.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [syncScheduleMirror, refreshQuery, scheduleQuery, categoriesQuery]);

  const handleEndReached = useCallback(() => {
    if (loadingMoreRef.current) return;
    if (!scheduleQuery.hasNextPage || scheduleQuery.isFetchingNextPage) return;
    loadingMoreRef.current = true;
    void scheduleQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [scheduleQuery]);

  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const classes = useMemo(() => {
    return scheduleQuery.data?.pages.flat() ?? [];
  }, [scheduleQuery.data?.pages]);

  const handleClassPress = useCallback((id: string) => {
    router.push(`/classes/${id}?origin=schedule`);
  }, [router]);

  const { data: memberDisciplines } = useMemberDisciplines();
  const enrolledDisciplineIds = useMemo(() => {
    return new Set(memberDisciplines?.map((md) => md.disciplineId) ?? []);
  }, [memberDisciplines]);

  // ── Layout ──────────────────────────────────────────────────────────────
  const topInset = useAppTopInset();
  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const renderItem = useCallback(
    ({ item, index }: { item: ClassItem; index: number }) => {
      const isEnrolled = item.disciplineId ? enrolledDisciplineIds.has(item.disciplineId) : false;
      return (
        <ClassRow
          item={item}
          index={index}
          entranceSignal={entranceSignal}
          onPressId={handleClassPress}
          isEnrolled={isEnrolled}
        />
      );
    },
    [entranceSignal, handleClassPress, enrolledDisciplineIds],
  );

  const screenPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
    }),
    [contentBottomInset, inset.lg, screenPaddingTop],
  );

  const isInitialLoading =
    !scheduleQuery.data &&
    isQueryActivelyLoading(scheduleQuery.isLoading, scheduleQuery.isFetching || refreshQuery.isFetching);
  const errorMessage = refreshQuery.error instanceof Error ? refreshQuery.error.message : null;
  const hasError = !!refreshQuery.error;
  const hasData = classes.length > 0;
  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });

  usePerfOnceReady(PerfMark.routeScheduleFirstContent, !isInitialLoading);

  const listContentStyle = useMemo(
    () => [screenPadding, !hasData && !hasError ? styles.emptyListContent : null],
    [hasData, hasError, screenPadding],
  );

  // ── List components ─────────────────────────────────────────────────────
  const listHeaderInner = useMemo(
    () => (
      <>
        <ScheduleHeaderMotion index={0} replayKey={entranceReplayKey} motion="title">
          <ScheduleSectionHeader />
        </ScheduleHeaderMotion>
        <ScheduleHeaderMotion index={1} replayKey={entranceReplayKey}>
          <ScheduleFilterBar
            options={filterOptions}
            selected={category}
            onSelect={(value) => {
              if (value === null) {
                setCategory(null);
                return;
              }
              if (isScheduleCategory(value)) setCategory(value);
            }}
          />
        </ScheduleHeaderMotion>
        {errorMessage && hasData ? (
          <View style={styles.errorWrap}>
            <StateBlock
              kind="error"
              title="Schedule unavailable"
              message={errorMessage}
              actionLabel="Retry"
              onAction={handleRetry}
              offlineAwareRetry
            />
          </View>
        ) : null}
      </>
    ),
    [filterOptions, category, entranceReplayKey, errorMessage, hasData, handleRetry],
  );

  const listHeader = useMemo(
    () => <View style={styles.listHeader}>{listHeaderInner}</View>,
    [listHeaderInner],
  );

  const listEmptyComponent = useMemo(
    () =>
      hasError ? null : (
        <ScheduleEmptyState
          loading={scheduleQuery.isFetching && classes.length === 0}
        />
      ),
    [hasError, scheduleQuery.isFetching, classes.length],
  );

  const listFooterComponent = useMemo(
    () =>
      scheduleQuery.isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <SkeletonRect height={136} borderRadius={radius.card} />
          <SkeletonRect height={136} borderRadius={radius.card} style={styles.footerSkeletonGap} />
        </View>
      ) : null,
    [radius.card, scheduleQuery.isFetchingNextPage],
  );

  const listExtraData = useMemo(() => ({ category }), [category]);
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={pullRefreshing}
        onRefresh={handlePullRefresh}
        tintColor={colors.accent.default}
      />
    ),
    [colors.accent.default, handlePullRefresh, pullRefreshing],
  );

  // ── Render ──────────────────────────────────────────────────────────────
  const scheduleList = (
    <FlashList
      renderScrollComponent={FlashListScrollComponent}
      style={styles.list}
      data={classes}
      extraData={listExtraData}
      drawDistance={200}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      contentContainerStyle={listContentStyle}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.25}
      ListEmptyComponent={listEmptyComponent}
      ListFooterComponent={listFooterComponent}
      refreshControl={refreshControl}
    />
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {isOfflineBlocked ? (
        <View style={[styles.centered, screenPadding]}>
          <StateBlock
            kind="error"
            title={OFFLINE_TITLE}
            message={OFFLINE_MESSAGE}
            actionLabel="Retry"
            onAction={handleRetry}
            offlineAwareRetry
          />
        </View>
      ) : hasError && !hasData && !isInitialLoading ? (
        <View style={[styles.centered, screenPadding]}>
            <StateBlock
              kind="error"
              title="Schedule unavailable"
              message={errorMessage ?? 'Please check your connection.'}
              actionLabel="Retry"
              onAction={handleRetry}
              offlineAwareRetry
            />
        </View>
      ) : (
        <LoadingCrossfade
          isLoaded={!isInitialLoading}
          skeleton={
            <View style={screenPadding}>
              {listHeader}
              <ScheduleSkeleton />
            </View>
          }
        >
          {scheduleList}
        </LoadingCrossfade>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  listHeader: {
    gap: 12,
    paddingBottom: 8,
  },
  list: { flex: 1 },
  emptyListContent: { flexGrow: 1 },
  errorWrap: { marginBottom: 8 },
  footerLoader: { marginVertical: 16 },
  footerSkeletonGap: { marginTop: 14 },
});
