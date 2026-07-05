import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  BeltReviewHubTabToggle,
  type BeltReviewHubTab,
} from '@/features/coach/components/belt/BeltReviewHubTabToggle';
import { openCoachBeltReviewMember } from '@/features/coach/components/belt/beltReviewNavigation';
import {
  PROMOTION_CANDIDATE_ITEM_HEIGHT,
  PromotionCandidateCard,
} from '@/features/coach/components/promotions/PromotionCandidateCard';
import { useCoachAssignedDisciplines } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { useBeltReviewHub } from '@/features/coach/hooks/useBeltReviewHub';
import type { BeltReviewHubMember } from '@/features/coach/hooks/useBeltReviewHub';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { ScrollRevealCard } from '@/shared/animations';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

type HubHeaderMotionProps = {
  children: React.ReactNode;
  replayKey: number;
};

function HubHeaderMotion({ children, replayKey }: HubHeaderMotionProps) {
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

type MemberRowProps = {
  item: BeltReviewHubMember;
  index: number;
  entranceSignal: SharedValue<number>;
  onPress: (item: BeltReviewHubMember) => void;
};

const MemberRow = React.memo(function MemberRow({
  item,
  index,
  entranceSignal,
  onPress,
}: MemberRowProps) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <ScrollRevealCard
      itemId={item.userId}
      index={index}
      entranceSignal={entranceSignal}
      itemStride={PROMOTION_CANDIDATE_ITEM_HEIGHT}
    >
      <PromotionCandidateCard
        item={item}
        signedInToday={item.signedInToday}
        onPress={handlePress}
      />
    </ScrollRevealCard>
  );
});

export default function CoachBeltReviewHubScreen() {
  const { colors, inset, gap, layout } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const [hubTab, setHubTab] = useState<BeltReviewHubTab>('on-mat');

  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const assignedRankDiscipline = assignedDisciplinesQuery.primaryRankDiscipline;
  const assignedRankDisciplineSlug = assignedDisciplinesQuery.primaryRankDisciplineSlug;
  const hasAssignedRankDiscipline = assignedRankDisciplineSlug !== null;

  const hubQuery = useBeltReviewHub(assignedRankDisciplineSlug);
  const { replayKey: entranceReplayKey, entranceSignal } = useTabEntrance();

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const listData = useMemo(
    () => (hubTab === 'on-mat' ? hubQuery.signedInToday : hubQuery.readyToPromote),
    [hubQuery.readyToPromote, hubQuery.signedInToday, hubTab],
  );

  const handleMemberPress = useCallback(
    (item: BeltReviewHubMember) => {
      if (!assignedRankDisciplineSlug) return;
      triggerLightImpact();
      openCoachBeltReviewMember(router, item, assignedRankDisciplineSlug);
    },
    [assignedRankDisciplineSlug, router],
  );

  const handleRetry = useCallback(() => {
    void hubQuery.refetch();
  }, [hubQuery]);

  const renderItem = useCallback(
    ({ item, index }: { item: BeltReviewHubMember; index: number }) => (
      <MemberRow
        item={item}
        index={index}
        entranceSignal={entranceSignal}
        onPress={handleMemberPress}
      />
    ),
    [entranceSignal, handleMemberPress],
  );

  const listHeader = useMemo(
    () => (
      <HubHeaderMotion replayKey={entranceReplayKey}>
        <View style={[styles.heroTextSection, { gap: gap.sm, marginBottom: gap.lg }]}>
          <AcademyEyebrow
            label={
              assignedRankDiscipline
                ? `${assignedRankDiscipline.displayName} belt review`
                : 'Belt review'
            }
            accent
          />
          <TabHeroTitle lines={[[{ text: 'Review & ' }, { text: 'promote.', accent: true }]]} />
        </View>

        {hasAssignedRankDiscipline ? (
          <View style={{ marginBottom: gap.lg }}>
            <BeltReviewHubTabToggle
              tab={hubTab}
              onTabChange={setHubTab}
              signedInCount={hubQuery.signedInToday.length}
              readyCount={hubQuery.readyToPromote.length}
            />
          </View>
        ) : null}
      </HubHeaderMotion>
    ),
    [
      assignedRankDiscipline,
      entranceReplayKey,
      gap,
      hasAssignedRankDiscipline,
      hubQuery.readyToPromote.length,
      hubQuery.signedInToday.length,
      hubTab,
    ],
  );

  const listFooter = useMemo(() => {
    if (!hubQuery.hasError || listData.length === 0) return null;

    return (
      <View style={{ marginTop: gap.md }}>
        <StateBlock
          kind="error"
          title="Sync issue"
          message="Could not refresh belt review data."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </View>
    );
  }, [gap.md, handleRetry, hubQuery.hasError, listData.length]);

  const listEmpty = useMemo(() => {
    if (assignedDisciplinesQuery.isLoading || hubQuery.isLoading) return null;
    if (!hasAssignedRankDiscipline) {
      return (
        <StateBlock
          kind="empty"
          title="No rank discipline assigned"
          message="Belt reviews are available when your coach profile is linked to BJJ or Wrestling."
        />
      );
    }
    if (hubQuery.hasError) return null;

    if (hubTab === 'on-mat') {
      return (
        <StateBlock
          kind="empty"
          title="No one checked in yet"
          message={
            hubQuery.heroClass
              ? `When members check in for ${hubQuery.heroClass.title}, they will show up here.`
              : 'Members on the mat today will appear in this tab.'
          }
        />
      );
    }

    return (
      <StateBlock
        kind="empty"
        title="No members in queue"
        message="Members appear here when they reach promotion readiness."
      />
    );
  }, [
    assignedDisciplinesQuery.isLoading,
    hasAssignedRankDiscipline,
    hubQuery.hasError,
    hubQuery.heroClass,
    hubQuery.isLoading,
    hubTab,
  ]);

  const isLoading =
    assignedDisciplinesQuery.isLoading ||
    (hasAssignedRankDiscipline && hubQuery.isLoading);

  const hasHubData =
    hubQuery.signedInToday.length > 0 || hubQuery.readyToPromote.length > 0;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {isLoading ? (
        <View style={{ flex: 1, marginTop: screenPaddingTop }}>
          <StateBlock kind="loading" title="Loading belt review" />
        </View>
      ) : hubQuery.hasError && !hasHubData ? (
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
            title="Could not load belt review"
            message={hubQuery.errorMessage}
            actionLabel="Retry"
            onAction={handleRetry}
          />
        </View>
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={hasAssignedRankDiscipline ? listData : []}
          extraData={hubTab}
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
