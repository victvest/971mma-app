import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  PROMOTION_CANDIDATE_ITEM_HEIGHT,
  PromotionCandidateCard,
} from '@/features/coach/components/promotions/PromotionCandidateCard';
import { usePromotionCandidates } from '@/features/coach/hooks/useCoachMode';
import { useCoachAssignedDisciplines } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { ScrollRevealCard } from '@/shared/animations';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import type { PromotionCandidateItem } from '@/types/domain';

type PromotionsHeaderMotionProps = {
  children: React.ReactNode;
  replayKey: number;
};

function PromotionsHeaderMotion({ children, replayKey }: PromotionsHeaderMotionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(38);

  React.useEffect(() => {
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

type CandidateRowProps = {
  item: PromotionCandidateItem;
  index: number;
  entranceSignal: SharedValue<number>;
  onPress: (item: PromotionCandidateItem) => void;
};

const CandidateRow = React.memo(function CandidateRow({
  item,
  index,
  entranceSignal,
  onPress,
}: CandidateRowProps) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <ScrollRevealCard
      itemId={item.userId}
      index={index}
      entranceSignal={entranceSignal}
      itemStride={PROMOTION_CANDIDATE_ITEM_HEIGHT}
    >
      <PromotionCandidateCard item={item} onPress={handlePress} />
    </ScrollRevealCard>
  );
});

export default function CoachPromotionsScreen() {
  const { colors, inset, gap, layout, typography } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();

  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const assignedRankDiscipline = assignedDisciplinesQuery.primaryRankDiscipline;
  const assignedRankDisciplineSlug = assignedDisciplinesQuery.primaryRankDisciplineSlug;
  const hasAssignedRankDiscipline = assignedRankDisciplineSlug !== null;

  const candidatesQuery = usePromotionCandidates(assignedRankDisciplineSlug, {
    enabled: hasAssignedRankDiscipline && !assignedDisciplinesQuery.isLoading,
  });

  const { replayKey: entranceReplayKey, entranceSignal } = useTabEntrance();

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const candidates = useMemo(
    () => (candidatesQuery.data ?? []).filter((item) => item.candidateReason !== 'tracking'),
    [candidatesQuery.data],
  );

  const hasError = !!candidatesQuery.error;
  const hasData = candidates.length > 0;
  const errorMessage =
    candidatesQuery.error instanceof Error
      ? candidatesQuery.error.message
      : 'Please check your connection.';

  const handleCandidatePress = useCallback(
    (item: PromotionCandidateItem) => {
      if (!assignedRankDisciplineSlug) return;

      router.push({
        pathname: '/(coach)/belt-review',
        params: {
          memberId: item.userId,
          memberName: item.fullName,
          memberEmail: item.email,
          memberRank: item.beltRank ?? 'Unranked',
          memberStripes: String(item.beltStripes),
          discipline: assignedRankDisciplineSlug,
        },
      });
    },
    [assignedRankDisciplineSlug, router],
  );

  const handleRetry = useCallback(() => {
    void candidatesQuery.refetch();
  }, [candidatesQuery]);

  const renderItem = useCallback(
    ({ item, index }: { item: PromotionCandidateItem; index: number }) => (
      <CandidateRow
        item={item}
        index={index}
        entranceSignal={entranceSignal}
        onPress={handleCandidatePress}
      />
    ),
    [entranceSignal, handleCandidatePress],
  );

  const listHeader = useMemo(
    () => (
      <PromotionsHeaderMotion replayKey={entranceReplayKey}>
        <View style={[styles.heroTextSection, { gap: gap.sm, marginBottom: gap.lg }]}>
          <AcademyEyebrow
            label={
              assignedRankDiscipline
                ? `${assignedRankDiscipline.displayName} promotion queue`
                : 'Promotion queue'
            }
            accent
          />
          <TabHeroTitle lines={[[{ text: 'Ready to ' }, { text: 'promote.', accent: true }]]} />
          {assignedRankDiscipline ? (
            <Text
              style={[
                typography.textPresets.body,
                { color: colors.text.secondary, marginTop: gap.xs },
              ]}
            >
              Showing members enrolled in {assignedRankDiscipline.displayName}.
            </Text>
          ) : null}
        </View>
      </PromotionsHeaderMotion>
    ),
    [
      assignedRankDiscipline,
      colors.text.secondary,
      entranceReplayKey,
      gap.lg,
      gap.sm,
      gap.xs,
      typography.textPresets.body,
    ],
  );

  const listFooter = useMemo(() => {
    if (hasError && hasData) {
      return (
        <View style={{ marginTop: gap.sm }}>
          <StateBlock
            kind="error"
            title="Sync issue"
            message="Could not refresh promotion candidates."
            actionLabel="Retry"
            onAction={handleRetry}
          />
        </View>
      );
    }
    return null;
  }, [gap.sm, handleRetry, hasData, hasError]);

  const listEmpty = useMemo(() => {
    if (assignedDisciplinesQuery.isLoading) return null;
    if (candidatesQuery.isLoading || hasError) return null;
    if (!hasAssignedRankDiscipline) {
      return (
        <StateBlock
          kind="empty"
          title="No rank discipline assigned"
          message="Promotion reviews appear when your coach profile is assigned to BJJ or Wrestling."
        />
      );
    }
    return (
      <StateBlock
        kind="empty"
        title="No candidates yet"
        message="Members appear here when they reach 80%+ on current stripe requirements."
      />
    );
  }, [
    assignedDisciplinesQuery.isLoading,
    candidatesQuery.isLoading,
    hasAssignedRankDiscipline,
    hasError,
  ]);

  const isLoading =
    assignedDisciplinesQuery.isLoading ||
    (hasAssignedRankDiscipline && candidatesQuery.isLoading);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {isLoading ? (
        <View style={{ flex: 1, marginTop: screenPaddingTop }}>
          <StateBlock kind="loading" title="Loading candidates" />
        </View>
      ) : hasError && !hasData ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: inset.lg,
            marginTop: screenPaddingTop,
          }}
        >
          <StateBlock
            kind="error"
            title="Could not load candidates"
            message={errorMessage}
            actionLabel="Retry"
            onAction={handleRetry}
          />
        </View>
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={hasAssignedRankDiscipline ? candidates : []}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: screenPaddingTop,
            paddingBottom: contentBottomInset + 120,
          }}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroTextSection: {
    marginTop: 8,
  },
});
