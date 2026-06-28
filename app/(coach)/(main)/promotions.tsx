import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from 'react-native';
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
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { ScrollRevealCard } from '@/shared/animations';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { triggerLightImpact } from '@/shared/haptics';
import type { PromotionCandidateItem } from '@/types/domain';

type PromotionsHeaderMotionProps = {
  children: React.ReactNode;
  replayKey: number;
};

function PromotionsHeaderMotion({ children, replayKey }: PromotionsHeaderMotionProps) {
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
  const { colors, inset, gap, layout, radius, typography } = useTheme();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();

  const [selectedDiscipline, setSelectedDiscipline] = useState<'bjj' | 'wrestling'>('bjj');
  const candidatesQuery = usePromotionCandidates(selectedDiscipline);

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
      router.push({
        pathname: '/(coach)/belt-review',
        params: {
          memberId: item.userId,
          memberName: item.fullName,
          memberEmail: item.email,
          memberRank: item.beltRank ?? 'Unranked',
          memberStripes: String(item.beltStripes),
          discipline: selectedDiscipline,
        },
      });
    },
    [router, selectedDiscipline],
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
        <View style={[styles.heroTextSection, { gap: gap.sm, marginBottom: gap.md }]}>
          <AcademyEyebrow label="Promotion queue" accent />
          <TabHeroTitle lines={[[{ text: 'Ready to ' }, { text: 'promote.', accent: true }]]} />
        </View>

        <View style={[styles.switcherContainer, { backgroundColor: colors.fill.secondary, borderRadius: radius.pill, padding: 4, flexDirection: 'row', marginBottom: gap.lg }]}>
          {(['bjj', 'wrestling'] as const).map((discipline) => {
            const isActive = selectedDiscipline === discipline;
            return (
              <TouchableOpacity
                key={discipline}
                onPress={() => {
                  triggerLightImpact();
                  setSelectedDiscipline(discipline);
                }}
                style={{
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
                }}
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
                  {discipline === 'bjj' ? 'BJJ' : 'Wrestling'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PromotionsHeaderMotion>
    ),
    [entranceReplayKey, gap.sm, gap.md, gap.lg, selectedDiscipline, colors, radius, typography],
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
    if (candidatesQuery.isLoading || hasError) return null;
    return (
      <StateBlock
        kind="empty"
        title="No candidates yet"
        message="Members appear here when they reach 80%+ on current stripe requirements."
      />
    );
  }, [candidatesQuery.isLoading, hasError]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {candidatesQuery.isLoading ? (
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
          data={candidates}
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
  switcherContainer: {
    alignSelf: 'stretch',
  },
});
