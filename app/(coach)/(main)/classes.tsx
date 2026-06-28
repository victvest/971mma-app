import React, { memo, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  LoadingCrossfade,
  ScrollRevealCard,
  ScheduleSkeleton,
} from '@/shared/animations';
import { animations } from '@/shared/theme/animations';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { isGymToday } from '@/core/time/gymTime';
import { useCoachClasses } from '@/features/coach/hooks/useCoachMode';
import { ScheduleClassCard } from '@/features/schedule/components/ScheduleClassCard';
import { ScheduleListRow } from '@/features/schedule/components/ScheduleListRow';
import { StateBlock } from '@/shared/components/StateBlock';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import type { ClassItem } from '@/types/domain';

type SectionHeaderItem = {
  _kind: 'header';
  id: string;
  label: string;
  sectionIndex: number;
};

type ClassListItem = {
  _kind: 'class';
  item: ClassItem;
  classIndex: number;
};

type ListItem = SectionHeaderItem | ClassListItem;

type ClassRowProps = {
  item: ClassItem;
  classIndex: number;
  entranceSignal: SharedValue<number>;
  onPressId: (id: string) => void;
};

const ClassRow = memo(function ClassRow({
  item,
  classIndex,
  entranceSignal,
  onPressId,
}: ClassRowProps) {
  const handlePress = useCallback(() => onPressId(item.id), [item.id, onPressId]);

  return (
    <ScrollRevealCard
      itemId={item.id}
      index={classIndex}
      entranceSignal={entranceSignal}
    >
      <ScheduleListRow accessibilityLabel={item.title} onPress={handlePress}>
        <ScheduleClassCard item={item} embedded />
      </ScheduleListRow>
    </ScrollRevealCard>
  );
});

type SectionHeaderProps = {
  label: string;
  sectionIndex: number;
  replayKey: number;
};

const SectionHeaderRow = memo(function SectionHeaderRow({
  label,
  sectionIndex,
  replayKey,
}: SectionHeaderProps) {
  const { colors, typography, inset, gap } = useTheme();
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(34);

  useEffect(() => {
    const delay = Math.min(sectionIndex, 4) * animations.stagger.base;
    opacity.value = 0;
    translateY.value = 38;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [opacity, replayKey, sectionIndex, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text
        style={[
          typography.textPresets.screenEyebrow,
          {
            color: colors.text.secondary,
            marginBottom: gap.sm,
            marginTop: sectionIndex === 0 ? gap.xs : gap.lg,
            paddingHorizontal: inset.xs,
          },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
});

type ScheduleHeaderMotionProps = {
  children: React.ReactNode;
  replayKey: number;
};

function ScheduleHeaderMotion({ children, replayKey }: ScheduleHeaderMotionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(38);

  useEffect(() => {
    opacity.value = 0;
    translateY.value = 42;
    opacity.value = withDelay(0, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(0, withSpring(0, animations.spring.gentle));
  }, [opacity, replayKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function CoachClassesScreen() {
  const { colors, inset, layout } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const classesQuery = useCoachClasses();

  const { replayKey: entranceReplayKey, entranceSignal } = useTabEntrance();

  const sections = useMemo(() => {
    const all = classesQuery.data ?? [];
    return {
      today: all.filter((item) => isGymToday(item.startsAt)),
      upcoming: all.filter((item) => !isGymToday(item.startsAt)),
    };
  }, [classesQuery.data]);

  const listData = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let classIndex = 0;
    let sectionIndex = 0;

    if (sections.today.length > 0) {
      result.push({
        _kind: 'header',
        id: 'header-today',
        label: `Today · ${sections.today.length}`,
        sectionIndex,
      });
      sectionIndex += 1;
      for (const item of sections.today) {
        result.push({ _kind: 'class', item, classIndex });
        classIndex += 1;
      }
    }

    if (sections.upcoming.length > 0) {
      result.push({
        _kind: 'header',
        id: 'header-upcoming',
        label: `Upcoming · ${sections.upcoming.length}`,
        sectionIndex,
      });
      sectionIndex += 1;
      for (const item of sections.upcoming) {
        result.push({ _kind: 'class', item, classIndex });
        classIndex += 1;
      }
    }

    return result;
  }, [sections]);

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const screenPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
    }),
    [contentBottomInset, inset.lg, screenPaddingTop],
  );

  const handleClassPress = useCallback(
    (id: string) => {
      router.push(`/(coach)/run-class/${id}`);
    },
    [router],
  );

  const handleRetry = useCallback(() => {
    void classesQuery.refetch();
  }, [classesQuery]);

  const getItemType = useCallback((item: ListItem) => item._kind, []);

  const keyExtractor = useCallback(
    (item: ListItem) => (item._kind === 'header' ? item.id : item.item.id),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item._kind === 'header') {
        return (
          <SectionHeaderRow
            label={item.label}
            sectionIndex={item.sectionIndex}
            replayKey={entranceReplayKey}
          />
        );
      }

      return (
        <ClassRow
          item={item.item}
          classIndex={item.classIndex}
          entranceSignal={entranceSignal}
          onPressId={handleClassPress}
        />
      );
    },
    [entranceSignal, handleClassPress],
  );

  const hasError = Boolean(classesQuery.error);
  const hasData = listData.length > 0;
  const isInitialLoading = classesQuery.isLoading && !classesQuery.data;
  const errorMessage =
    classesQuery.error instanceof Error
      ? classesQuery.error.message
      : 'Please check your connection.';

  const listHeaderInner = useMemo(
    () => (
      <>
        <ScheduleHeaderMotion replayKey={entranceReplayKey}>
          <View style={styles.heroTextSection}>
            <AcademyEyebrow label="Today's schedule" accent showFlag={false} />
            <TabHeroTitle lines={[[{ text: 'Your ' }, { text: 'classes.', accent: true }]]} />
          </View>
        </ScheduleHeaderMotion>
        {hasError && hasData ? (
          <View style={styles.errorWrap}>
            <StateBlock
              kind="error"
              title="Sync issue"
              message="Could not refresh class schedule."
              actionLabel="Retry"
              onAction={handleRetry}
            />
          </View>
        ) : null}
      </>
    ),
    [entranceReplayKey, handleRetry, hasData, hasError],
  );

  const listHeader = useMemo(
    () => <View style={styles.listHeader}>{listHeaderInner}</View>,
    [listHeaderInner],
  );

  const listEmptyComponent = useMemo(
    () =>
      hasError ? null : (
        <StateBlock kind="empty" title="No classes today" message="Your schedule will appear here." />
      ),
    [hasError],
  );

  const listContentStyle = useMemo(
    () => [screenPadding, !hasData && !hasError ? styles.emptyListContent : null],
    [hasData, hasError, screenPadding],
  );

  const classesList = (
    <FlashList
      renderScrollComponent={FlashListScrollComponent}
      style={styles.list}
      data={listData}
      drawDistance={200}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      contentContainerStyle={listContentStyle}
      ListEmptyComponent={listEmptyComponent}
    />
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {hasError && !hasData && !isInitialLoading ? (
        <View style={[styles.centered, screenPadding]}>
          <StateBlock
            kind="error"
            title="Could not load classes"
            message={errorMessage}
            actionLabel="Retry"
            onAction={handleRetry}
          />
        </View>
      ) : (
        <LoadingCrossfade
          isLoaded={!isInitialLoading}
          skeleton={
            <View style={screenPadding}>
              {listHeader}
              <ScheduleSkeleton showHeader={false} showFilters={false} />
            </View>
          }
        >
          {classesList}
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
  list: { flex: 1 },
  listHeader: {
    gap: 12,
    paddingBottom: 8,
  },
  heroTextSection: {
    gap: 8,
    marginTop: 8,
  },
  emptyListContent: { flexGrow: 1 },
  errorWrap: { marginBottom: 8 },
});
