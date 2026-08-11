import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { useTheme } from '@/shared/theme';
import type { ScannedMember } from '@/features/coach/hooks/useBeltReviewHub';

const AVATAR_SIZE = 44;

function formatBelt(beltRank: string | null, beltStripes: number): string {
  if (!beltRank?.trim()) return 'Unranked';
  const stripe = beltStripes === 1 ? '1 stripe' : `${beltStripes} stripes`;
  return `${beltRank.trim()} · ${stripe}`;
}

type Props = {
  item: ScannedMember;
  onPress: (item: ScannedMember) => void;
  isLast?: boolean;
};

export const ScannedMemberRow = memo(function ScannedMemberRow({ item, onPress, isLast }: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const initials = useMemo(() => initialsFromName(item.fullName), [item.fullName]);
  const avatarUrl = useMemo(
    () => resolveRollCallMemberAvatar({ avatarUrl: item.avatarUrl, displayName: item.fullName }),
    [item.avatarUrl, item.fullName],
  );
  const beltLine = useMemo(
    () => formatBelt(item.beltRank, item.beltStripes),
    [item.beltRank, item.beltStripes],
  );

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={() => onPress(item)}
      accessibilityLabel={`${item.fullName}, ${beltLine}`}
      accessibilityRole="button"
      style={[
        styles.row,
        {
          paddingHorizontal: inset.lg,
          paddingVertical: inset.md,
          borderBottomColor: isLast ? 'transparent' : colors.border.subtle,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatarWrap,
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: colors.accent.subtle,
            marginRight: 12,
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.userId}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <Text
            style={[
              typography.textPresets.captionMedium,
              { color: colors.accent.default, fontWeight: typography.fontWeight.semibold },
            ]}
          >
            {initials}
          </Text>
        )}
      </View>

      {/* Name + belt */}
      <View style={[styles.info, { gap: gap.xs }]}>
        <Text
          style={[typography.textPresets.bodyMedium, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {item.fullName}
        </Text>
        <Text
          style={[typography.textPresets.caption, { color: colors.text.secondary }]}
          numberOfLines={1}
        >
          {beltLine}
        </Text>
      </View>

      {/* Class count pill */}
      {item.classCount > 0 && (
        <View
          style={[
            styles.pill,
            {
              backgroundColor: colors.surface.tertiary,
              borderRadius: radius.badge,
              paddingHorizontal: inset.sm,
              paddingVertical: inset['2xs'],
              gap: gap.xs,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={11} color={colors.text.secondary} />
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
            {item.classCount}
          </Text>
        </View>
      )}

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.text.tertiary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  chevron: {
    marginLeft: 4,
    flexShrink: 0,
  },
});
