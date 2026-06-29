import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatLocalDisplay } from '@/core/time/gymTime';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { CommunityReactionBar } from '@/features/communities/components/CommunityReactionBar';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

export { COMMUNITY_REACTIONS } from '@/features/communities/components/CommunityReactionBar';

type CommunityPostCardProps = {
  post: CommunityPostItem;
  onPress?: () => void;
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
};

export function CommunityPostCard({ post, onPress, onReact, readOnly = false }: CommunityPostCardProps) {
  const { colors, typography, inset, gap, radius, layout, shadows } = useTheme();

  const content = (
    <>
      <View style={styles.headerRow}>
        <MemberAvatar
          name={post.authorName}
          avatarUrl={post.authorAvatarUrl}
          size={40}
          backgroundColor={colors.accent.default}
          textColor={colors.text.inverse}
        />
        <View style={styles.headerCopy}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={[styles.time, { color: colors.text.tertiary }]}>
            {formatLocalDisplay(post.publishedAt)}
          </Text>
        </View>
      </View>

      {post.title ? (
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>{post.title}</Text>
      ) : null}

      <Text style={[typography.textPresets.body, { color: colors.text.secondary, lineHeight: 22 }]}>
        {post.body}
      </Text>

      <View style={[styles.footerRow, { gap: gap.sm }]}>
        <CommunityReactionBar
          reactionCounts={post.reactionCounts}
          myReactions={post.myReactions}
          onReact={onReact}
          readOnly={readOnly}
        />

        <View style={styles.replyMeta}>
          <Text style={[styles.replyCount, { color: colors.text.tertiary }]}>
            {post.replyCount} repl{post.replyCount === 1 ? 'y' : 'ies'}
          </Text>
        </View>
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    shadows.card,
    {
      backgroundColor: colors.surface.primary,
      borderColor: colors.border.subtle,
      borderRadius: radius.cardLarge,
      borderWidth: layout.borderWidth,
      padding: inset.md,
      gap: gap.sm,
    },
  ];

  if (!onPress) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={post.title ?? 'Community post'}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.92 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  replyMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  replyCount: {
    fontSize: 12,
    fontWeight: '600',
  },
});
