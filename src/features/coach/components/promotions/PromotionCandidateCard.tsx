import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { AnimatedProgressRing } from '@/shared/animations';
import { useTheme } from '@/shared/theme';
import type { PromotionCandidateItem } from '@/types/domain';

/** Card height + list gap — used by ScrollRevealCard stride math. */
export const PROMOTION_CANDIDATE_ITEM_HEIGHT = 220;

const CARD_MIN_HEIGHT = 204;
const PROGRESS_RING_SIZE = 52;

function reasonLabel(reason: PromotionCandidateItem['candidateReason']): string {
  if (reason === 'ready_for_stripe') return 'Ready to promote';
  if (reason === 'near_ready') return 'Near ready';
  return 'Tracking';
}

function getReadinessTreatment(
  reason: PromotionCandidateItem['candidateReason'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  if (reason === 'ready_for_stripe') {
    return {
      bg: colors.accent.default,
      text: colors.accent.onAccent,
    };
  }
  return {
    bg: colors.status.warning,
    text: colors.text.inverse,
  };
}

function formatBeltLine(beltRank: string | null, beltStripes: number): string {
  if (!beltRank?.trim()) return 'Unranked';
  return `${beltRank.trim()} · stripe ${beltStripes}`;
}

type MemberPhotoProps = {
  item: PromotionCandidateItem;
};

const MemberPhoto = memo(function MemberPhoto({ item }: MemberPhotoProps) {
  const { colors, typography } = useTheme();
  const initials = useMemo(() => initialsFromName(item.fullName), [item.fullName]);
  const avatarUrl = useMemo(
    () => resolveRollCallMemberAvatar({ avatarUrl: item.avatarUrl, displayName: item.fullName }),
    [item.avatarUrl, item.fullName],
  );

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={item.userId}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`${item.fullName} photo`}
      />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.initialsSurface,
        { backgroundColor: colors.accent.subtle },
      ]}
      accessibilityLabel={`${item.fullName} initials`}
    >
      <Text style={[typography.textPresets.coachDisplayCompact, { color: colors.accent.default }]}>
        {initials}
      </Text>
    </View>
  );
});

type Props = {
  item: PromotionCandidateItem;
  onPress: () => void;
  signedInToday?: boolean;
  interactive?: boolean;
};

export const PromotionCandidateCard = memo(function PromotionCandidateCard({
  item,
  onPress,
  signedInToday = false,
  interactive = true,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const treatment = getReadinessTreatment(item.candidateReason, colors);
  const isComplete = item.percent >= 100;
  const beltLine = useMemo(
    () => formatBeltLine(item.beltRank, item.beltStripes),
    [item.beltRank, item.beltStripes],
  );
  const handlePress = useCallback(() => onPress(), [onPress]);

  const cardStyle = [
    styles.card,
    {
      minHeight: CARD_MIN_HEIGHT,
      borderRadius: radius.cardLarge,
      backgroundColor: colors.surface.secondary,
      borderColor: colors.border.subtle,
      borderWidth: layout.borderWidth,
      marginBottom: gap.md,
    },
  ];

  const content = (
    <>
      <MemberPhoto item={item} />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.08)', colors.media.scrimMiddle, colors.media.scrimBottom]}
        locations={[0.12, 0.55, 1]}
        style={styles.scrim}
      />

      <View style={[styles.topOverlay, { padding: inset.md, gap: gap.sm }]}>
        <View style={[styles.badgeRow, { gap: gap.xs }]}>
          {signedInToday ? (
            <View
              style={[
                styles.readinessBadge,
                {
                  backgroundColor: colors.accent.default,
                  borderRadius: radius.badge,
                  paddingHorizontal: inset.sm,
                  paddingVertical: inset.xs,
                },
              ]}
            >
              <Text
                style={[typography.textPresets.captionMedium, { color: colors.accent.onAccent }]}
                numberOfLines={1}
              >
                On mat
              </Text>
            </View>
          ) : null}
          {item.candidateReason !== 'tracking' ? (
            <View
              style={[
                styles.readinessBadge,
                {
                  backgroundColor: treatment.bg,
                  borderRadius: radius.badge,
                  paddingHorizontal: inset.sm,
                  paddingVertical: inset.xs,
                },
              ]}
            >
              <Text
                style={[typography.textPresets.captionMedium, { color: treatment.text }]}
                numberOfLines={1}
              >
                {reasonLabel(item.candidateReason)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.ringSlot}>
          <AnimatedProgressRing
            size={PROGRESS_RING_SIZE}
            strokeWidth={4}
            percent={item.percent}
            trackColor="rgba(255,255,255,0.35)"
            progressColor={isComplete ? colors.accent.default : colors.text.inverse}
            animate={false}
          >
            <Text
              style={[
                typography.textPresets.captionMedium,
                { color: colors.text.inverse, fontWeight: typography.fontWeight.bold },
              ]}
            >
              {item.percent.toFixed(0)}%
            </Text>
          </AnimatedProgressRing>
        </View>
      </View>

      <View style={[styles.footer, { padding: inset.lg, gap: gap.xs }]}>
        <Text
          style={[typography.textPresets.coachName, styles.name, { color: colors.text.inverse }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.fullName}
        </Text>
        <Text
          style={[typography.textPresets.body, styles.belt, { color: colors.text.inverse }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {beltLine}
        </Text>
      </View>
    </>
  );

  if (!interactive) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <HomeAnimatedPressable
      onPress={handlePress}
      accessibilityLabel={item.fullName}
      style={cardStyle}
    >
      {content}
    </HomeAnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  topOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  badgeRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  ringSlot: {
    flexShrink: 0,
  },
  readinessBadge: {
    flexShrink: 0,
  },
  footer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  initialsSurface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  belt: {
    opacity: 0.92,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
