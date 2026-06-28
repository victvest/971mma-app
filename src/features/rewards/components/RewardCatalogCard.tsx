import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations';
import { useTheme, radii } from '@/shared/theme';
import { isLegendaryReward, resolveRewardImage } from '@/features/rewards/utils/rewardImages';
import type { PointsTier, RewardItem } from '@/types/domain';

type Props = {
  item: RewardItem;
  balance: number;
  tier: PointsTier;
  pendingRewardId: string | null;
  readOnly?: boolean;
  onRedeem: (rewardId: string) => void;
};

function tierRank(tier: PointsTier): number {
  if (tier === 'gold') return 3;
  if (tier === 'silver') return 2;
  return 1;
}

function rewardRequiredTier(reward: RewardItem): PointsTier | null {
  const required = reward.unlockRule.requiresTier;
  return required === 'silver' || required === 'gold' || required === 'bronze' ? required : null;
}

function rewardHasPendingConfig(reward: RewardItem): boolean {
  return reward.unlockRule.placeholder === true;
}

export const RewardCatalogCard = memo(function RewardCatalogCard({
  item,
  balance,
  tier,
  pendingRewardId,
  readOnly = false,
  onRedeem,
}: Props) {
  const { colors, typography, radius, gap, shadows, layout } = useTheme();
  const imageSource = resolveRewardImage(item);
  const legendary = isLegendaryReward(item);
  const requiredTier = rewardRequiredTier(item);
  const lockedByTier = requiredTier ? tierRank(tier) < tierRank(requiredTier) : false;
  const outOfStock = item.inventory !== null && item.inventory <= 0;
  const unaffordable = balance < item.costPoints;
  const pendingConfig = rewardHasPendingConfig(item);
  const disabled =
    lockedByTier || outOfStock || unaffordable || pendingRewardId !== null || readOnly || pendingConfig;
  const pointsShortfall = Math.max(0, item.costPoints - balance);
  const isPending = pendingRewardId === item.id;

  let buttonLabel = 'REDEEM';
  if (isPending) {
    buttonLabel = '...';
  } else if (pendingConfig) {
    buttonLabel = 'SOON';
  } else if (lockedByTier) {
    buttonLabel = 'LOCKED';
  } else if (outOfStock) {
    buttonLabel = 'SOLD OUT';
  } else if (unaffordable) {
    buttonLabel = `NEED ${pointsShortfall.toLocaleString('en-US')} MORE`;
  }

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          gap: gap.sm,
        },
      ]}
    >
      <View style={styles.imageArea}>
        {legendary ? (
          <View style={[styles.legendaryBadge, { backgroundColor: colors.status.warning }]}>
            <Ionicons name="star" size={10} color={colors.text.primary} />
            <Text style={[styles.legendaryText, { color: colors.text.primary }]}>LEGENDARY</Text>
          </View>
        ) : null}

        <Image
          source={imageSource}
          style={[
            styles.image,
            {
              borderTopLeftRadius: radius.cardLarge - layout.borderWidth,
              borderTopRightRadius: radius.cardLarge - layout.borderWidth,
            },
          ]}
          contentFit="contain"
          transition={200}
          accessibilityLabel={item.name}
        />
      </View>

      <View style={{ gap: 2.8, flex: 1, paddingHorizontal: gap.md }}>
        <Text
          style={[typography.textPresets.bodyStrong, styles.title, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.pointsCost, { color: colors.status.error }]}>
          {item.costPoints.toLocaleString('en-US')} Points
        </Text>
      </View>

      <MotiPressable
        onPress={() => onRedeem(item.id)}
        disabled={disabled}
        style={[
          styles.actionButton,
          {
            backgroundColor: disabled ? colors.fill.secondary : colors.accent.default,
            borderRadius: radius.pill,
            marginHorizontal: gap.md,
            marginBottom: gap.md,
          },
        ]}
      >
        <Text
          style={[
            styles.actionLabel,
            { color: disabled ? colors.text.secondary : colors.accent.onAccent },
          ]}
          numberOfLines={1}
        >
          {buttonLabel}
        </Text>
      </MotiPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  imageArea: {
    aspectRatio: 1,
    position: 'relative',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  legendaryBadge: {
    alignItems: 'center',
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: 4,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 10,
    zIndex: 1,
  },
  legendaryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    letterSpacing: -0.2,
  },
  pointsCost: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
