import React, { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
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
  CoachRoleChip,
  getCoachImageSource,
  getCoachRatingLabel,
  getCoachRoleLabel,
  getCoachSpecialtyLabel,
  RatingPill,
} from '@/features/coaches/components/CoachVisuals';
import {
  useCoaches,
} from '@/features/coaches/hooks/useCoaches';
import { useCoachDirectoryImagePrefetch } from '@/features/coaches/hooks/useCoachDirectoryImagePrefetch';
import { HomeElevatedCard } from '@/features/home/components/HomeElevatedCard';
import { HomeSectionTitle } from '@/features/home/components/HomeSectionTitle';
import { StateBlock } from '@/shared/components/StateBlock';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { TabHeroTitle, AcademyEyebrow } from '@/shared/components/brand';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';
import type { CoachItem } from '@/types/domain';

type CoachesSectionMotion = 'default' | 'title' | 'featured';

type CoachesAnimatedSectionProps = {
  children: ReactNode;
  index: number;
  replayKey?: number;
  entranceSignal?: SharedValue<number>;
  motion?: CoachesSectionMotion;
  style?: StyleProp<ViewStyle>;
};

function runCoachesSectionEntrance(
  opacity: SharedValue<number>,
  translateY: SharedValue<number>,
  index: number,
  motion: CoachesSectionMotion,
) {
  'worklet';
  const delay = Math.min(index, 8) * animations.stagger.base;
  opacity.value = 0;
  translateY.value = motion === 'featured' ? 56 : 42;
  opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
  translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
}

function CoachesAnimatedSection({
  children,
  index,
  replayKey = 0,
  entranceSignal,
  motion = 'default',
  style,
}: CoachesAnimatedSectionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(42);

  useEffect(() => {
    runCoachesSectionEntrance(opacity, translateY, index, motion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, motion]);

  useEffect(() => {
    if (entranceSignal) return;
    runCoachesSectionEntrance(opacity, translateY, index, motion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  useAnimatedReaction(
    () => entranceSignal?.value ?? null,
    (current, previous) => {
      if (current === null || previous === null || current === previous) return;
      runCoachesSectionEntrance(opacity, translateY, index, motion);
    },
    [entranceSignal, index, motion],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type CoachAnimatedPressableProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CoachAnimatedPressable({
  children,
  onPress,
  accessibilityLabel,
  style,
  scaleTo = 0.985,
}: CoachAnimatedPressableProps) {
  const scale = useSharedValue<number>(1);
  const opacity = useSharedValue<number>(1);

  const handlePressIn = useCallback(() => {
    triggerLightImpact();
    scale.value = withSpring(scaleTo, animations.spring.snappy);
    opacity.value = withTiming(0.92, animations.timing.press);
  }, [opacity, scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
    opacity.value = withTiming(1, animations.timing.press);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

type FeaturedCoachCardProps = {
  coach: CoachItem;
  height: number;
  onPressId: (id: string) => void;
};

const FeaturedCoachCard = memo(function FeaturedCoachCard({
  coach,
  height,
  onPressId,
}: FeaturedCoachCardProps) {
  const { colors, typography, inset, gap, radius, shadows } = useTheme();
  const rating = getCoachRatingLabel(coach);
  const handlePress = useCallback(() => onPressId(coach.id), [coach.id, onPressId]);

  return (
    <CoachAnimatedPressable
      onPress={handlePress}
      accessibilityLabel={`View ${coach.name}`}
      scaleTo={0.98}
      style={[styles.featuredShadowWrap, shadows.mediaHero, { borderRadius: radius.cardLarge }]}
    >
      <View style={[styles.featuredCard, { height, borderRadius: radius.cardLarge }]}>
        <Image
          source={getCoachImageSource(coach)}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={coach.id}
          transition={200}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
        />
        <UaeBrandAmbientGlow variant="photo-card" />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.42, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
        />

        <View style={[styles.featuredContent, { padding: inset.md, gap: gap.md }]}>
          <View style={[styles.featuredBadgeRow, { gap: gap.sm }]}>
            <CoachRoleChip label={getCoachRoleLabel(coach)} headCoach={coach.isHeadCoach} />
            <RatingPill rating={rating} />
          </View>

          <View style={[styles.featuredFooter, { gap: gap.sm }]}>
            <View style={styles.featuredText}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[typography.textPresets.title, styles.featuredName, { color: colors.text.inverse }]}
              >
                {coach.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.textPresets.body, styles.featuredSpecialty, { color: colors.text.inverse }]}
              >
                {getCoachSpecialtyLabel(coach)}
              </Text>
            </View>
            <View style={[styles.featuredChevron, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <ChevronRight size={18} color={colors.text.inverse} strokeWidth={2.25} />
            </View>
          </View>
        </View>
      </View>
    </CoachAnimatedPressable>
  );
});

function FeaturedCoachLoadingCard({ height }: { height: number }) {
  const { colors } = useTheme();

  return (
    <HomeElevatedCard
      style={{ height, width: '100%' }}
      contentStyle={styles.featuredLoadingCard}
    >
      <ActivityIndicator size="large" color={colors.accent.default} />
    </HomeElevatedCard>
  );
}

type CoachGridCardProps = {
  item: CoachItem;
  index: number;
  entranceSignal: SharedValue<number>;
  onPressId: (id: string) => void;
};

const CoachGridCard = memo(function CoachGridCard({
  item,
  index,
  entranceSignal,
  onPressId,
}: CoachGridCardProps) {
  const { colors, typography, inset, gap, radius, shadows } = useTheme();
  const rating = getCoachRatingLabel(item);
  const handlePress = useCallback(() => onPressId(item.id), [item.id, onPressId]);

  return (
    <CoachesAnimatedSection index={index + 3} entranceSignal={entranceSignal}>
      <View
        style={[
          styles.gridCell,
          {
            paddingLeft: index % 2 === 0 ? undefined : gap.xs,
            paddingRight: index % 2 === 0 ? gap.xs : undefined,
            paddingBottom: gap.md,
          },
        ]}
      >
        <CoachAnimatedPressable
          onPress={handlePress}
          accessibilityLabel={`View ${item.name}`}
          style={styles.gridPressable}
        >
          <View
            style={[
              styles.gridImageFrame,
              shadows.card,
              {
                borderRadius: radius.cardLarge,
                backgroundColor: colors.surface.secondary,
              },
            ]}
          >
            <Image
              source={getCoachImageSource(item, index + 1)}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item.id}
              transition={200}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
            />
            <UaeBrandAmbientGlow variant="photo-card" />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.82)']}
              locations={[0.35, 0.72, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
            />
            <View style={[styles.gridRating, { top: inset.sm, right: inset.sm }]}>
              <RatingPill rating={rating} />
            </View>
            <View style={[styles.gridOverlay, { padding: inset.sm, gap: gap.xs }]}>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  typography.textPresets.subtitle,
                  styles.gridName,
                  { color: colors.text.inverse, fontWeight: typography.fontWeight.bold },
                ]}
              >
                {item.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.textPresets.caption, styles.gridSpecialty, { color: colors.text.inverse }]}
              >
                {getCoachSpecialtyLabel(item)}
              </Text>
            </View>
          </View>
        </CoachAnimatedPressable>
      </View>
    </CoachesAnimatedSection>
  );
});

import { useAuthStore } from '@/stores/useAuthStore';

export default function CoachesScreen() {
  const { colors, inset, gap, layout } = useTheme();
  usePerfRouteMount(PerfMark.routeCoachesMount);
  const { width } = useWindowDimensions();
  const { contentBottomInset } = useResponsiveLayout();
  const router = useRouter();
  const coachesQuery = useCoaches();
  const { replayKey: entranceReplayKey, entranceSignal } = useTabEntrance();

  const handleRefresh = useCallback(async () => {
    await coachesQuery.refetch();
  }, [coachesQuery]);

  const coaches = useMemo(() => coachesQuery.data ?? [], [coachesQuery.data]);
  useCoachDirectoryImagePrefetch(coaches);
  const featuredCoach = useMemo(
    () => coaches.find((coach) => coach.isHeadCoach) ?? coaches[0] ?? null,
    [coaches],
  );
  const gridCoaches = useMemo(
    () => (featuredCoach ? coaches.filter((coach) => coach.id !== featuredCoach.id) : coaches),
    [coaches, featuredCoach],
  );
  const errorMessage =
    coachesQuery.error instanceof Error ? coachesQuery.error.message : null;

  const loading = coachesQuery.isLoading && !coachesQuery.data;
  const hasError = !!errorMessage;
  const hasData = coaches.length > 0;

  usePerfOnceReady(PerfMark.routeCoachesFirstContent, !loading && (hasData || hasError));

  const heroWidth = width - inset.lg * 2;
  const heroHeight = Math.max(
    layout.coachFeatureHeroMinHeight,
    heroWidth * layout.coachFeatureHeroRatio,
  );
  const topInset = useAppTopInset();
  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const handleCoachPress = useCallback(
    (id: string) => router.push(`/coaches/${id}?origin=coaches`),
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: CoachItem; index: number }) => (
      <CoachGridCard
        item={item}
        index={index}
        entranceSignal={entranceSignal}
        onPressId={handleCoachPress}
      />
    ),
    [entranceSignal, handleCoachPress],
  );

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
    }),
    [inset.lg, screenPaddingTop, contentBottomInset],
  );

  const listHeader = useMemo(
    () => (
      <View style={[styles.listHeader, { paddingTop: inset.xs }]}>
        {errorMessage && hasData ? (
          <View style={{ marginBottom: inset.md }}>
            <StateBlock
              kind="error"
              title="Coaches unavailable"
              message={errorMessage}
              actionLabel="Retry"
              onAction={handleRefresh}
            />
          </View>
        ) : null}

        <CoachesAnimatedSection index={0} replayKey={entranceReplayKey} motion="title">
          <View style={{ gap: gap.xs, marginBottom: inset.md }}>
            <AcademyEyebrow label="The team" accent showFlag={false} />
            <TabHeroTitle
              lines={[[{ text: 'Learn from' }], [{ text: 'the best.', accent: true }]]}
            />
          </View>
        </CoachesAnimatedSection>

        {featuredCoach ? (
          <CoachesAnimatedSection
            index={1}
            replayKey={entranceReplayKey}
            motion="featured"
            style={{ marginBottom: layout.coachSectionTopGap }}
          >
            <FeaturedCoachCard
              coach={featuredCoach}
              height={heroHeight}
              onPressId={handleCoachPress}
            />
          </CoachesAnimatedSection>
        ) : loading ? (
          <CoachesAnimatedSection
            index={1}
            replayKey={entranceReplayKey}
            motion="featured"
            style={{ marginBottom: layout.coachSectionTopGap }}
          >
            <FeaturedCoachLoadingCard height={heroHeight} />
          </CoachesAnimatedSection>
        ) : null}

        {gridCoaches.length > 0 ? (
          <CoachesAnimatedSection index={2} replayKey={entranceReplayKey}>
            <HomeSectionTitle title="All coaches" />
          </CoachesAnimatedSection>
        ) : null}
      </View>
    ),
    [
      entranceReplayKey,
      errorMessage,
      featuredCoach,
      gap.xs,
      gridCoaches.length,
      handleCoachPress,
      handleRefresh,
      hasData,
      heroHeight,
      inset.lg,
      inset.md,
      inset.xs,
      layout.coachSectionTopGap,
      loading,
    ],
  );

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {hasError && !hasData ? (
        <View
          style={[
            styles.loadingWrap,
            {
              paddingHorizontal: inset.lg,
              paddingTop: screenPaddingTop,
              justifyContent: 'center',
            },
          ]}
        >
          <StateBlock
            kind="error"
            title="Coaches unavailable"
            message={errorMessage ?? 'Please check your connection.'}
            actionLabel="Retry"
            onAction={handleRefresh}
          />
        </View>
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={gridCoaches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={listContentStyle}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            loading ? null : hasError ? null : !featuredCoach ? (
              <StateBlock
                kind="empty"
                title="No coaches yet"
                message="The academy coach directory will appear here once configured."
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listHeader: {
    width: '100%',
  },
  loadingWrap: {
    flex: 1,
  },
  featuredShadowWrap: {
    width: '100%',
  },
  featuredCard: {
    overflow: 'hidden',
    width: '100%',
  },
  featuredLoadingCard: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  imageFill: {
    height: '100%',
    width: '100%',
  },
  featuredContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  featuredBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featuredFooter: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  featuredText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  featuredName: {
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuredSpecialty: {
    opacity: 0.9,
  },
  featuredChevron: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  gridCell: {
    flex: 1,
  },
  gridPressable: {
    width: '100%',
  },
  gridImageFrame: {
    aspectRatio: 0.82,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  gridRating: {
    position: 'absolute',
    zIndex: 2,
  },
  gridOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  gridName: {
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridSpecialty: {
    opacity: 0.9,
  },
});
