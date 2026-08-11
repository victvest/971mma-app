import React, { memo, useMemo } from 'react';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassMediaChip, AppScrollView } from '@/shared/components/ui';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';
import { academyAssets } from '@/features/academy/assets';
import { resolveClassImage } from '@/features/schedule/utils/classImages';
import { isGymUsageClass } from '@/features/schedule/utils/classDisplay';
import { formatGymTime12h, isGymToday } from '@/core/time/gymTime';
import type { ClassItem } from '@/types/domain';

const CARD_PEEK = 20;
/** Portrait hero ratio (width : height = 4 : 5), scaled down 20% */
const HERO_CARD_HEIGHT_RATIO = (5 / 4) * 0.8;
const HERO_ACTION_HEIGHT_SCALE = 0.9;

function formatClassStatus(classItem: ClassItem) {
  const startTime = new Date(classItem.startsAt);
  const now = new Date();
  const diffMs = startTime.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins > 0 && diffMins <= 60) {
    return { statusText: `IN ${diffMins} MIN`, isLive: true };
  }
  if (diffMins <= 0 && diffMins >= -classItem.durationMinutes) {
    return { statusText: 'LIVE NOW', isLive: true };
  }

  const timeLabel = formatGymTime12h(classItem.startsAt);
  const dayLabel = isGymToday(classItem.startsAt, now)
    ? 'TODAY'
    : new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        weekday: 'short',
      })
        .format(startTime)
        .toUpperCase();
  return { statusText: `${dayLabel} · ${timeLabel}`, isLive: false };
}

function formatSpots(classItem: ClassItem) {
  if (isGymUsageClass(classItem)) return 'OPEN FLOOR';
  const remainingSpots = classItem.capacity - classItem.bookedCount;
  if (classItem.capacity <= 0) return 'OPEN FLOOR';
  return remainingSpots > 0 ? `${remainingSpots} spots` : 'Full';
}

type HeroGlassActionButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const HeroGlassActionButton = memo(function HeroGlassActionButton({
  label,
  onPress,
  style,
}: HeroGlassActionButtonProps) {
  const { colors, typography, radius } = useTheme();

  return (
    <HomeAnimatedPressable
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.glassActionShell, { borderRadius: radius.button }, style]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={52} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="none" style={styles.glassActionVeil} />
      <Text
        style={[
          typography.textPresets.button,
          styles.glassActionLabel,
          { color: colors.text.inverse },
        ]}
      >
        {label}
      </Text>
    </HomeAnimatedPressable>
  );
});

type HeroClassCardItemProps = {
  classItem: ClassItem;
  width: number;
  onViewDetails: () => void;
  onSeeAll: () => void;
};

const HeroClassCardItem = memo(function HeroClassCardItem({
  classItem,
  width,
  onViewDetails,
  onSeeAll,
}: HeroClassCardItemProps) {
  const { colors, typography, radius, surfaceShadow, inset, gap, layout } = useTheme();
  const cardHeight = width * HERO_CARD_HEIGHT_RATIO;
  const actionHeight = layout.coachActionHeight * HERO_ACTION_HEIGHT_SCALE;

  const gymUsageHero = isGymUsageClass(classItem);
  // Signature instructor photo is reserved for Gym Usage on home only.
  const imageSource = gymUsageHero
    ? academyAssets.gymUsageHero
    : resolveClassImage(classItem.discipline, classItem.imageUrl ?? null, classItem.title);
  const { statusText, isLive } = formatClassStatus(classItem);
  const spotsText = formatSpots(classItem);

  return (
    <View style={[styles.shadowWrap, surfaceShadow('mediaHero'), { width }]}>
      <View style={[styles.cardShell, { borderRadius: radius.cardLarge }]}>
        <View style={[styles.mediaFrame, { height: cardHeight }]}>
          <Image
            source={imageSource}
            style={styles.mediaImage}
            contentFit="cover"
            contentPosition={gymUsageHero ? 'top center' : 'center'}
          />
          <UaeBrandAmbientGlow variant="photo-card" />
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.92)']}
            locations={[0, 0.45, 1]}
            style={styles.scrim}
          />

          <View style={[styles.chipRow, { left: inset.lg, right: inset.lg, top: inset.lg }]}>
            <GlassMediaChip live={isLive}>
              {isLive ? (
                <View style={[styles.liveDot, { backgroundColor: colors.text.inverse }]} />
              ) : null}
              <Text
                style={[
                  typography.textPresets.label,
                  styles.chipText,
                  { color: colors.text.inverse },
                ]}
              >
                {statusText}
              </Text>
            </GlassMediaChip>
            <GlassMediaChip>
              <Text
                style={[
                  typography.textPresets.label,
                  styles.chipText,
                  { color: colors.text.inverse },
                ]}
              >
                {spotsText.toUpperCase()}
              </Text>
            </GlassMediaChip>
          </View>

          <View
            style={[
              styles.content,
              { bottom: inset.lg, left: inset.lg, right: inset.lg, gap: gap.sm },
            ]}
          >
            <Text
              style={[typography.textPresets.hero, styles.title, { color: colors.text.inverse }]}
              numberOfLines={2}
            >
              {classItem.title}
            </Text>
            <Text
              style={[typography.textPresets.body, styles.meta, { color: colors.text.inverse }]}
              numberOfLines={1}
            >
              {gymUsageHero
                ? classItem.level || 'Open floor'
                : `${classItem.level || 'All levels'} · Coach ${classItem.coachName}`}
            </Text>

            <View style={[styles.actionRow, { gap: gap.sm, marginTop: gap.xs }]}>
              <HomeAnimatedPressable
                onPress={onViewDetails}
                accessibilityLabel={`View details for ${classItem.title}`}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.accent.default,
                    borderRadius: radius.button,
                    minHeight: actionHeight,
                  },
                ]}
              >
                <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                  View details
                </Text>
              </HomeAnimatedPressable>

              <HeroGlassActionButton
                label="See all"
                onPress={onSeeAll}
                style={{ minHeight: actionHeight }}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});

type Props = {
  classes: ClassItem[];
  onClassPress: (id: string) => void;
  onOpenSchedule: () => void;
};

export function HeroClassCard({ classes, onClassPress, onOpenSchedule }: Props) {
  const { inset, gap } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const isCarousel = classes.length > 1;
  const cardGap = gap.md;
  const insetCardWidth = screenWidth - inset.lg * 2;
  const carouselCardWidth = screenWidth - inset.lg - CARD_PEEK;
  const snapOffsets = useMemo(
    () => classes.map((_, index) => index * (carouselCardWidth + cardGap)),
    [carouselCardWidth, cardGap, classes],
  );
  const bleedShellStyle = useMemo(
    () => [styles.bleedShell, { marginHorizontal: -inset.lg, width: screenWidth }],
    [inset.lg, screenWidth],
  );
  const carouselContentStyle = useMemo(
    () => ({
      flexDirection: 'row' as const,
      gap: cardGap,
      paddingLeft: inset.lg,
      paddingRight: CARD_PEEK,
    }),
    [cardGap, inset.lg],
  );

  if (classes.length === 0) {
    return null;
  }

  if (!isCarousel) {
    const classItem = classes[0]!;
    return (
      <HeroClassCardItem
        classItem={classItem}
        width={insetCardWidth}
        onViewDetails={() => onClassPress(classItem.id)}
        onSeeAll={onOpenSchedule}
      />
    );
  }

  return (
    <View style={bleedShellStyle}>
      <AppScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        alwaysBounceHorizontal={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        contentContainerStyle={carouselContentStyle}
      >
        {classes.map((classItem) => (
          <HeroClassCardItem
            key={classItem.id}
            classItem={classItem}
            width={carouselCardWidth}
            onViewDetails={() => onClassPress(classItem.id)}
            onSeeAll={onOpenSchedule}
          />
        ))}
      </AppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bleedShell: {
    overflow: 'hidden',
  },
  shadowWrap: {
    flexShrink: 0,
  },
  cardShell: {
    overflow: 'hidden',
    width: '100%',
  },
  mediaFrame: {
    overflow: 'hidden',
    width: '100%',
  },
  mediaImage: {
    height: '100%',
    width: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    position: 'absolute',
  },
  liveDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  chipText: {
    letterSpacing: 0.4,
  },
  content: {
    position: 'absolute',
  },
  title: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  meta: {
    opacity: 0.88,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  glassActionShell: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 0.5,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
    position: 'relative',
  },
  glassActionVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.58)',
  },
  glassActionLabel: {
    zIndex: 1,
  },
});
