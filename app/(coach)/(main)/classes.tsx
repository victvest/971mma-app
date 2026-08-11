import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { LoadingCrossfade, ScrollRevealCard, ScheduleSkeleton } from '@/shared/animations';
import { animations } from '@/shared/theme/animations';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { isGymToday, isGymTomorrow } from '@/core/time/gymTime';
import { useCoachClasses } from '@/features/coach/hooks/useCoachMode';
import { openRunClassHub } from '@/features/coach/roll-call/utils/rollCallNavigation';
import { ScheduleClassCard } from '@/features/schedule/components/ScheduleClassCard';
import { ScheduleListRow } from '@/features/schedule/components/ScheduleListRow';
import { StateBlock } from '@/shared/components/StateBlock';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage, USER_FACING_LOAD_ERROR } from '@/lib/userFacingError';
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

type TodayEmptyItem = {
  _kind: 'today-empty';
  id: string;
  sectionIndex: number;
};

type ListItem = SectionHeaderItem | ClassListItem | TodayEmptyItem;

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
    <ScrollRevealCard itemId={item.id} index={classIndex} entranceSignal={entranceSignal}>
      <ScheduleListRow accessibilityLabel={item.title} onPress={handlePress}>
        <ScheduleClassCard item={item} embedded />
      </ScheduleListRow>
    </ScrollRevealCard>
  );
});

type SectionHeaderProps = {
  label: string;
  sectionIndex: number;
  entranceSignal: SharedValue<number>;
};

const SectionHeaderRow = memo(function SectionHeaderRow({
  label,
  sectionIndex,
  entranceSignal,
}: SectionHeaderProps) {
  const { colors, typography, inset, gap } = useTheme();
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(34);

  const runAnimation = useCallback(() => {
    'worklet';
    const delay = Math.min(sectionIndex, 4) * animations.stagger.base;
    opacity.value = 0;
    translateY.value = 38;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [opacity, sectionIndex, translateY]);

  useEffect(() => {
    runAnimation();
  }, [runAnimation]);

  useAnimatedReaction(
    () => entranceSignal.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runAnimation();
      }
    },
    [entranceSignal, runAnimation],
  );

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
  entranceSignal: SharedValue<number>;
};

function ScheduleHeaderMotion({ children, entranceSignal }: ScheduleHeaderMotionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(38);

  const runAnimation = useCallback(() => {
    'worklet';
    opacity.value = 0;
    translateY.value = 42;
    opacity.value = withDelay(0, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(0, withSpring(0, animations.spring.gentle));
  }, [opacity, translateY]);

  useEffect(() => {
    runAnimation();
  }, [runAnimation]);

  useAnimatedReaction(
    () => entranceSignal.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runAnimation();
      }
    },
    [entranceSignal, runAnimation],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function CoachClassesScreen() {
  const { colors, typography, inset, layout } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const classesQuery = useCoachClasses();

  const { entranceSignal } = useTabEntrance();

  const sections = useMemo(() => {
    const all = classesQuery.data ?? [];
    return {
      today: all.filter((item) => isGymToday(item.startsAt)),
      tomorrow: all.filter((item) => isGymTomorrow(item.startsAt)),
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
    } else if (sections.tomorrow.length > 0) {
      result.push({
        _kind: 'today-empty',
        id: 'today-empty',
        sectionIndex,
      });
      sectionIndex += 1;
    }

    if (sections.tomorrow.length > 0) {
      result.push({
        _kind: 'header',
        id: 'header-tomorrow',
        label: `Tomorrow · ${sections.tomorrow.length}`,
        sectionIndex,
      });
      sectionIndex += 1;
      for (const item of sections.tomorrow) {
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

  const handleClassPress = useCallback((id: string) => {
    openRunClassHub(id);
  }, []);

  const handleRetry = useCallback(() => {
    void classesQuery.refetch();
  }, [classesQuery]);

  const getItemType = useCallback((item: ListItem) => item._kind, []);

  const keyExtractor = useCallback(
    (item: ListItem) => (item._kind === 'class' ? item.item.id : item.id),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item._kind === 'header') {
        return (
          <SectionHeaderRow
            label={item.label}
            sectionIndex={item.sectionIndex}
            entranceSignal={entranceSignal}
          />
        );
      }

      if (item._kind === 'today-empty') {
        return (
          <View style={styles.todayEmptyWrap}>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              No classes today
            </Text>
            <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
              Tomorrow&apos;s schedule is below.
            </Text>
          </View>
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
    [
      colors.text.primary,
      colors.text.secondary,
      entranceSignal,
      handleClassPress,
      typography.textPresets.body,
      typography.textPresets.bodyStrong,
    ],
  );

  const hasError = Boolean(classesQuery.error);
  const hasData = listData.length > 0;
  const isInitialLoading = classesQuery.isLoading && !classesQuery.data;
  const errorMessage = toUserFacingErrorMessage(classesQuery.error, {
    fallback: USER_FACING_LOAD_ERROR,
  });

  const listHeaderInner = useMemo(
    () => (
      <>
        <ScheduleHeaderMotion entranceSignal={entranceSignal}>
          <View style={styles.heroTextSection}>
            <AcademyEyebrow label="Today & tomorrow" accent showFlag={false} />
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
    [entranceSignal, handleRetry, hasData, hasError],
  );

  const listHeader = useMemo(
    () => <View style={styles.listHeader}>{listHeaderInner}</View>,
    [listHeaderInner],
  );

  const listEmptyComponent = useMemo(() => {
    if (isInitialLoading) {
      return <ScheduleSkeleton showHeader={false} showFilters={false} />;
    }
    return hasError ? null : (
      <StateBlock
        kind="empty"
        title="No classes today or tomorrow"
        message="Your schedule will appear here."
      />
    );
  }, [isInitialLoading, hasError]);

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
        classesList
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
  todayEmptyWrap: {
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  errorWrap: { marginBottom: 8 },
});
