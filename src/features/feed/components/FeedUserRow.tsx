import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';
import type { FeedSearchUser } from '@/features/feed/types';
import { formatCompactCount, formatFeedBeltLine } from '@/features/feed/utils/feedFormat';
import { MemberAvatarWithCoachBadge } from './MemberAvatarWithCoachBadge';

type Props = {
  user: FeedSearchUser;
  onPress: (userId: string) => void;
};

export const FeedUserRow = memo(function FeedUserRow({ user, onPress }: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const beltLine = useMemo(
    () => formatFeedBeltLine(user.beltRank, user.beltStripes),
    [user.beltRank, user.beltStripes],
  );
  const metaLine = useMemo(() => {
    const parts = [
      `${formatCompactCount(user.postCount)} posts`,
      `${formatCompactCount(user.followerCount)} followers`,
    ];
    if (beltLine) parts.unshift(beltLine);
    return parts.join(' · ');
  }, [beltLine, user.followerCount, user.postCount]);

  return (
    <Pressable
      onPress={() => onPress(user.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${user.name}`}
      style={({ pressed }) => [
        styles.row,
        {
          opacity: pressed ? 0.72 : 1,
          borderRadius: radius.card,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          backgroundColor: colors.surface.primary,
          padding: inset.md,
          gap: gap.md,
        },
      ]}
    >
      <MemberAvatarWithCoachBadge
        name={user.name}
        avatarUrl={user.avatarUrl}
        size={46}
        showCoachBadge={user.isVerifiedCoach}
        backgroundColor={colors.accent.subtle}
        textColor={colors.accent.default}
      />
      <View style={styles.textBlock}>
        <View style={[styles.nameRow, { gap: gap.xs }]}>
          <Text
            numberOfLines={1}
            style={[typography.textPresets.bodyStrong, styles.name, { color: colors.text.primary }]}
          >
            {user.name}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={[typography.textPresets.caption, { color: colors.text.tertiary }]}
        >
          {metaLine}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
});
