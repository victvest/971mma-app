import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedProgressFill } from '@/shared/animations';
import { resolveMilestoneImage } from '@/features/rewards/utils/milestoneImages';
import { useTheme } from '@/shared/theme';
import type { MilestoneItem } from '@/types/domain';

type Props = {
  item: MilestoneItem;
  progressPct: number;
};

export const MilestoneRow = memo(function MilestoneRow({ item, progressPct }: Props) {
  const { colors, typography, radius, layout, shadows } = useTheme();
  const imageSource = resolveMilestoneImage(item);

  const isEarned = item.status === 'earned';
  const isNext = item.status === 'next';
  const isLocked = item.status === 'locked';
  const isActive = !isLocked;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          opacity: isLocked ? 0.88 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.imageWrap,
          {
            borderTopLeftRadius: radius.card - layout.borderWidth,
            borderBottomLeftRadius: radius.card - layout.borderWidth,
          },
        ]}
      >
        <Image
          source={imageSource}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          accessibilityLabel={item.name}
        />
        {isLocked ? <View style={[styles.imageDim, { backgroundColor: colors.background.overlay }]} /> : null}
      </View>

      <View style={styles.content}>
        <Text
          style={[
            typography.textPresets.bodyStrong,
            { color: isActive ? colors.text.primary : colors.text.secondary },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {item.description ?? `Unlock at ${item.unlockDays} days`}
        </Text>

        {isNext ? (
          <View style={styles.progressTrackWrap}>
            <View style={[styles.progressTrack, { backgroundColor: colors.fill.secondary }]}>
              <AnimatedProgressFill
                percent={progressPct}
                backgroundColor={colors.accent.default}
                style={styles.progressFill}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.statusCol}>
        {isEarned ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.status.successSubtle }]}>
            <Ionicons name="checkmark" size={10} color={colors.status.success} />
            <Text style={[styles.statusBadgeText, { color: colors.status.success }]}>EARNED</Text>
          </View>
        ) : isNext ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.accent.subtle }]}>
            <Text style={[styles.statusBadgeText, { color: colors.accent.default }]}>NEXT</Text>
          </View>
        ) : item.pointsAward > 0 ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.fill.secondary }]}>
            <Text style={[styles.statusBadgeText, { color: colors.text.secondary }]}>+{item.pointsAward}</Text>
          </View>
        ) : (
          <Ionicons name="lock-closed" size={16} color={colors.accent.default} style={{ opacity: 0.45 }} />
        )}
      </View>
    </View>
  );
});

const IMAGE_WIDTH = 96;

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 96,
    marginBottom: 10,
    overflow: 'hidden',
    width: '100%',
  },
  imageWrap: {
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: IMAGE_WIDTH,
  },
  image: {
    ...StyleSheet.absoluteFill,
    height: undefined,
    width: undefined,
  },
  imageDim: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  progressTrackWrap: {
    marginTop: 6,
    width: '100%',
  },
  progressTrack: {
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  statusCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 14,
    width: 72,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
