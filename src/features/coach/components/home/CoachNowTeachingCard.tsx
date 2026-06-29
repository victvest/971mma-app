import React, { memo } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GlassMediaChip } from '@/shared/components/ui';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { formatCoachClassTime } from '@/features/coach/utils/classDisplay';
import { isClassLiveNow } from '@/core/time/gymTime';
import { academyAssets } from '@/features/academy/assets';
import { useTheme } from '@/shared/theme';
import type { ClassItem } from '@/types/domain';

/** Portrait hero ratio (width : height = 4 : 5), scaled down 20% — matches member HeroClassCard. */
const HERO_CARD_HEIGHT_RATIO = (5 / 4) * 0.8;
const HERO_ACTION_HEIGHT_SCALE = 0.9;

type StatCellProps = {
  value: number | string;
  label: string;
  accentValue?: boolean;
};

const HeroStatCell = memo(function HeroStatCell({ value, label, accentValue }: StatCellProps) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.statCell}>
      <Text
        style={[
          typography.textPresets.metricValue,
          styles.statValue,
          { color: accentValue ? colors.accent.default : colors.text.inverse },
        ]}
      >
        {value}
      </Text>
      <Text style={[typography.textPresets.label, styles.statLabel, { color: colors.text.inverse }]}>
        {label}
      </Text>
    </View>
  );
});

type Props = {
  classItem: ClassItem | null;
  presentCount: number;
  missingCount: number;
  promoteCount: number;
  statsLoading?: boolean;
  presentLabel?: string;
  onPress: () => void;
};

export const CoachNowTeachingCard = memo(function CoachNowTeachingCard({
  classItem,
  presentCount,
  missingCount,
  promoteCount,
  statsLoading = false,
  presentLabel = 'PRESENT',
  onPress,
}: Props) {
  const { colors, inset, radius, layout, typography, shadows, gap } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - inset.lg * 2;
  const cardHeight = cardWidth * HERO_CARD_HEIGHT_RATIO;
  const actionHeight = layout.coachActionHeight * HERO_ACTION_HEIGHT_SCALE;
  const heroImage = academyAssets.homeCarouselHero;

  if (!classItem) {
    return (
      <View style={[styles.shadowWrap, shadows.mediaHero, { width: cardWidth }]}>
        <View style={[styles.cardShell, { borderRadius: radius.cardLarge }]}>
          <View style={[styles.mediaFrame, { height: cardHeight }]}>
            <Image source={heroImage} style={styles.mediaImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.92)']}
              locations={[0, 0.45, 1]}
              style={styles.scrim}
            />
            <View style={[styles.content, { bottom: inset.lg, left: inset.lg, right: inset.lg, gap: gap.sm }]}>
              <Text style={[typography.textPresets.label, styles.chipText, { color: colors.text.inverse }]}>
                COACH MODE
              </Text>
              <Text
                style={[typography.textPresets.hero, styles.title, { color: colors.text.inverse }]}
                numberOfLines={2}
              >
                You have no classes today
              </Text>
              <Text
                style={[typography.textPresets.body, styles.meta, { color: colors.text.inverse }]}
                numberOfLines={2}
              >
                Your schedule will appear here when sessions are assigned.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const isLive = isClassLiveNow(classItem.startsAt, classItem.durationMinutes);
  const time = formatCoachClassTime(classItem.startsAt);
  const statValue = statsLoading ? '—' : undefined;
  const imageSource = heroImage;
  const statusChipLabel = isLive ? 'IN SESSION' : 'UP NEXT';
  const liveChipLabel = isLive ? `LIVE · ${statusChipLabel}` : statusChipLabel;

  return (
    <View style={[styles.shadowWrap, shadows.mediaHero, { width: cardWidth }]}>
      <View style={[styles.cardShell, { borderRadius: radius.cardLarge }]}>
        <View style={[styles.mediaFrame, { height: cardHeight }]}>
          <Image source={imageSource} style={styles.mediaImage} contentFit="cover" />
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
              <Text style={[typography.textPresets.label, styles.chipText, { color: colors.text.inverse }]}>
                {liveChipLabel}
              </Text>
            </GlassMediaChip>
            <GlassMediaChip>
              <Text style={[typography.textPresets.label, styles.chipText, { color: colors.text.inverse }]}>
                {classItem.discipline.toUpperCase()}
              </Text>
            </GlassMediaChip>
          </View>

          <View style={[styles.content, { bottom: inset.lg, left: inset.lg, right: inset.lg, gap: gap.sm }]}>
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
              {time} · {classItem.level || 'All levels'}
            </Text>

            <View style={[styles.statsRow, { marginTop: gap.xs }]}>
              <HeroStatCell value={statValue ?? presentCount} label={presentLabel} />
              <HeroStatCell value={statValue ?? missingCount} label="MISSING" />
              <HeroStatCell value={promoteCount} label="PROMOTE" accentValue />
            </View>

            <HomeAnimatedPressable
              onPress={onPress}
              accessibilityLabel={`Run class ${classItem.title}`}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.accent.default,
                  borderRadius: radius.button,
                  minHeight: actionHeight,
                  marginTop: gap.xs,
                },
              ]}
            >
              <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                Run class
              </Text>
            </HomeAnimatedPressable>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
  statsRow: {
    flexDirection: 'row',
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statValue: {
    letterSpacing: -0.5,
  },
  statLabel: {
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    width: '100%',
  },
});