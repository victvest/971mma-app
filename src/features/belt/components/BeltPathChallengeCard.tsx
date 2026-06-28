import React from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BeltPathIconBadge } from '@/features/belt/components/BeltPathIconBadge';
import { BeltPathStatusBadge, type BeltPathBadgeStatus } from '@/features/belt/components/BeltPathStatusBadge';
import { useTheme } from '@/shared/theme';

export type BeltChallengeItem = {
  id: string;
  title: string;
  subtitle: string;
  status: BeltPathBadgeStatus;
  imageSource?: ImageSourcePropType;
  progressLabel?: string;
};

type Props = {
  item: BeltChallengeItem;
};

function getChallengeIcon(status: BeltPathBadgeStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'completed') return 'trophy';
  if (status === 'joined') return 'star';
  return 'lock-closed-outline';
}

export const BeltPathChallengeCard = React.memo(function BeltPathChallengeCard({ item }: Props) {
  const { colors, typography, radius, shadows, inset, gap } = useTheme();
  const isActive = item.status !== 'locked';
  const iconName = getChallengeIcon(item.status);
  const iconColor = isActive ? colors.accent.default : colors.text.tertiary;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderRadius: radius.cardLarge,
          padding: inset.md,
          gap: gap.md,
          opacity: isActive ? 1 : 0.92,
        },
      ]}
    >
      <View style={styles.row}>
        {item.imageSource ? (
          <View style={[styles.thumbnailWrap, { borderRadius: radius.thumbnail, opacity: isActive ? 1 : 0.55 }]}>
            <Image
              source={item.imageSource}
              style={[styles.thumbnail, { borderRadius: radius.thumbnail }]}
              contentFit="cover"
              transition={200}
            />
          </View>
        ) : (
          <BeltPathIconBadge active={isActive}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </BeltPathIconBadge>
        )}

        <View style={[styles.copy, { gap: 2 }]}>
          <Text
            style={[
              typography.textPresets.bodyStrong,
              { color: isActive ? colors.text.primary : colors.text.secondary },
            ]}
          >
            {item.title}
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
            {item.progressLabel ?? item.subtitle}
          </Text>
        </View>

        <BeltPathStatusBadge status={item.status} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {},
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  thumbnailWrap: {
    height: 44,
    overflow: 'hidden',
    width: 44,
  },
  thumbnail: {
    height: '100%',
    width: '100%',
  },
});
