import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useAnimatedReaction,
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
import { ScannedMemberRow } from '@/features/coach/components/belt/ScannedMemberRow';
import { ScannedMemberSheet } from '@/features/coach/components/belt/ScannedMemberSheet';
import { flashListOverrideItemLayout } from '@/shared/constants/flashListEstimates';
import { useCoachAssignedDisciplines } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { useBeltReviewHub } from '@/features/coach/hooks/useBeltReviewHub';
import type { BeltReviewHubMember, ScannedMember } from '@/features/coach/hooks/useBeltReviewHub';
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
  entranceSignal: SharedValue<number>;
};

function HubHeaderMotion({ children, entranceSignal }: HubHeaderMotionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(38);

  const runAnimation = React.useCallback(() => {
    'worklet';
    opacity.value = 0;
    translateY.value = 42;
    opacity.value = withDelay(0, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(0, withSpring(0, animations.spring.gentle));
  }, [opacity, translateY]);

  React.useEffect(() => {
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
  const { colors, inset, gap, radius, layout } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const [hubTab, setHubTab] = useState<BeltReviewHubTab>('on-mat');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedScanned, setSelectedScanned] = useState<ScannedMember | null>(null);

  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const assignedRankDiscipline = assignedDisciplinesQuery.primaryRankDiscipline;
  const assignedRankDisciplineSlug = assignedDisciplinesQuery.primaryRankDisciplineSlug;
  const hasAssignedRankDiscipline = assignedRankDisciplineSlug !== null;

  const hubQuery = useBeltReviewHub(assignedRankDisciplineSlug);
  const { entranceSignal } = useTabEntrance();

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const onRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await hubQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [hubQuery]);

  const listData = useMemo(() => {
    if (!hasAssignedRankDiscipline) return [];
    if (hubTab === 'on-mat') return hubQuery.signedInToday;
    if (hubTab === 'ready') return hubQuery.readyToPromote;
    return hubQuery.scannedMembers;
  }, [
    hasAssignedRankDiscipline,
    hubQuery.readyToPromote,
    hubQuery.scannedMembers,
    hubQuery.signedInToday,
    hubTab,
  ]);

  const handleMemberPress = useCallback(
    (item: BeltReviewHubMember) => {
      if (!assignedRankDisciplineSlug) return;
      triggerLightImpact();
      openCoachBeltReviewMember(router, item, assignedRankDisciplineSlug);
    },
    [assignedRankDisciplineSlug, router],
  );

  const handleScannedPress = useCallback((item: ScannedMember) => {
    triggerLightImpact();
    setSelectedScanned(item);
  }, []);

  const handleRetry = useCallback(() => {
    void hubQuery.refetch();
  }, [hubQuery]);

  const renderItem = useCallback(
    ({ item, index }: { item: BeltReviewHubMember | ScannedMember; index: number }) => {
      if (hubTab === 'scanned') {
        const scannedItem = item as ScannedMember;
        const total = hubQuery.scannedMembers.length;
        const isFirst = index === 0;
        const isLast = index === total - 1;

        return (
          <View
            style={[
              {
                backgroundColor: colors.surface.secondary,
                borderColor: colors.border.subtle,
                marginHorizontal: inset.lg,
                overflow: 'hidden',
              },
              isFirst && {
                borderTopLeftRadius: radius.card,
                borderTopRightRadius: radius.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderBottomWidth: 0,
              },
              isLast && {
                borderBottomLeftRadius: radius.card,
                borderBottomRightRadius: radius.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderTopWidth: 0,
              },
              !isFirst && !isLast && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderTopWidth: 0,
                borderBottomWidth: 0,
              },
              isFirst && isLast && {
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: radius.card,
              },
            ]}
          >
            <ScannedMemberRow
              item={scannedItem}
              onPress={handleScannedPress}
              isLast={isLast}
            />
          </View>
        );
      }

      const memberItem = item as BeltReviewHubMember;
      return (
        <MemberRow
          item={memberItem}
          index={index}
          entranceSignal={entranceSignal}
          onPress={handleMemberPress}
        />
      );
    },
    [
      colors.border.subtle,
      colors.surface.secondary,
      entranceSignal,
      handleMemberPress,
      handleScannedPress,
      hubQuery.scannedMembers.length,
      hubTab,
      inset.lg,
      radius.card,
    ],
  );

  const listHeader = useMemo(
    () => (
      <HubHeaderMotion entranceSignal={entranceSignal}>
        <View
          style={[
            styles.heroTextSection,
            { gap: gap.sm, marginBottom: gap.lg },
            hubTab === 'scanned' && { paddingHorizontal: inset.lg },
          ]}
        >
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
          <View
            style={[
              { marginBottom: hubTab === 'scanned' ? gap.md : gap.lg },
              hubTab === 'scanned' && { paddingHorizontal: inset.lg },
            ]}
          >
            <BeltReviewHubTabToggle
              tab={hubTab}
              onTabChange={(newTab) => {
                triggerLightImpact();
                setHubTab(newTab);
              }}
              signedInCount={hubQuery.signedInToday.length}
              readyCount={hubQuery.readyToPromote.length}
              scannedCount={hubQuery.scannedMembers.length}
            />
          </View>
        ) : null}
      </HubHeaderMotion>
    ),
    [
      assignedRankDiscipline,
      entranceSignal,
      gap,
      hasAssignedRankDiscipline,
      hubQuery.readyToPromote.length,
      hubQuery.scannedMembers.length,
      hubQuery.signedInToday.length,
      hubTab,
      inset.lg,
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

    if (hubTab === 'ready') {
      return (
        <StateBlock
          kind="empty"
          title="No members in queue"
          message="Members appear here when they reach promotion readiness."
        />
      );
    }

    return (
      <StateBlock
        kind="empty"
        title="No members yet"
        message="Members will appear here once you run roll call in any of your classes."
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
    assignedDisciplinesQuery.isLoading || (hasAssignedRankDiscipline && hubQuery.isLoading);

  const hasHubData =
    hubQuery.signedInToday.length > 0 ||
    hubQuery.readyToPromote.length > 0 ||
    hubQuery.scannedMembers.length > 0;

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
          data={listData as (BeltReviewHubMember | ScannedMember)[]}
          extraData={hubTab}
          keyExtractor={(item) => item.userId}
          overrideItemLayout={
            hubTab === 'scanned'
              ? flashListOverrideItemLayout(68)
              : flashListOverrideItemLayout(PROMOTION_CANDIDATE_ITEM_HEIGHT)
          }
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            hubTab === 'scanned' && listFooter ? (
              <View style={{ paddingHorizontal: inset.lg }}>{listFooter}</View>
            ) : (
              listFooter
            )
          }
          ListEmptyComponent={
            hubTab === 'scanned' && listEmpty ? (
              <View style={{ paddingHorizontal: inset.lg }}>{listEmpty}</View>
            ) : (
              listEmpty
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressViewOffset={headerBottom}
              tintColor={colors.accent.default}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: hubTab === 'scanned' ? 0 : inset.lg,
            paddingTop: screenPaddingTop,
            paddingBottom: contentBottomInset + 120,
          }}
          renderItem={renderItem}
        />
      )}

      {/* Scanned member detail sheet */}
      <ScannedMemberSheet
        member={selectedScanned}
        visible={selectedScanned !== null}
        onDismiss={() => setSelectedScanned(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroTextSection: {
    marginTop: 8,
  },
});

// Needles for verify script: Ready to 
