import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { CommunityOwnerBadge } from '@/features/communities/components/CommunityOwnerBadge';
import { CommunityReactionBar } from '@/features/communities/components/CommunityReactionBar';
import {
  COMMUNITY_CHAT_BUBBLE,
  formatCommunityMessageTime,
} from '@/features/communities/components/community-chat-utils';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

export type CommunityChatBubbleVariant = 'feed' | 'thread' | 'pinned';

type CommunityChatBubbleProps = {
  post: CommunityPostItem;
  variant?: CommunityChatBubbleVariant;
  showAvatar?: boolean;
  showUnread?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
};

export function CommunityChatBubble({
  post,
  variant = 'feed',
  showAvatar = true,
  showUnread = true,
  onPress,
  onLongPress,
  onReact,
  readOnly = false,
}: CommunityChatBubbleProps) {
  const { colors, typography, gap, layout } = useTheme();
  const isCoach = post.authorRole === 'coach';
  const timeLabel = formatCommunityMessageTime(post.publishedAt);
  const isInteractive = Boolean(onPress || onLongPress);
  const showTime = variant === 'thread';
  const isUnread = showUnread && Boolean(post.isUnread);

  const bubbleStyle = [
    styles.bubble,
    isCoach ? COMMUNITY_CHAT_BUBBLE.coach : COMMUNITY_CHAT_BUBBLE.member,
    variant === 'thread' ? styles.bubbleThread : styles.bubbleFeed,
    {
      backgroundColor: isCoach ? colors.accent.subtle : colors.surface.primary,
      borderColor: isUnread ? colors.accent.default : isCoach ? colors.accent.default : colors.border.subtle,
      borderWidth: isUnread ? 1.5 : layout.borderWidth,
      gap: gap.xs,
    },
  ];

  const bubbleBody = (
    <>
      {post.title ? (
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {post.title}
        </Text>
      ) : null}
      <Text
        selectable
        style={[typography.textPresets.body, { color: colors.text.secondary, lineHeight: 22 }]}
      >
        {post.body}
      </Text>
      {post.mediaUrl ? (
        <Image
          source={{ uri: post.mediaUrl }}
          style={[styles.media, { backgroundColor: colors.fill.secondary }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.row, { gap: gap.sm }]}>
        {showAvatar && isCoach ? (
          <MemberAvatar
            name={post.authorName}
            avatarUrl={post.authorAvatarUrl}
            size={36}
            backgroundColor={colors.accent.default}
            textColor={colors.text.inverse}
          />
        ) : showAvatar ? (
          <View style={styles.avatarSpacer} />
        ) : null}

        <View
          style={[
            styles.stack,
            variant === 'thread' ? styles.stackThread : styles.stackFeed,
            { gap: gap.xs },
          ]}
        >
          <View style={[styles.metaRow, { gap: gap.xs }]}>
            <Text
              style={[typography.textPresets.captionMedium, { color: colors.text.primary }]}
              numberOfLines={1}
            >
              {post.authorName}
            </Text>
            {isCoach ? <CommunityOwnerBadge compact /> : null}
            {isUnread ? (
              <View style={[styles.unreadPill, { backgroundColor: colors.status.error }]}>
                <Text style={[styles.unreadPillText, { color: colors.text.inverse }]}>New</Text>
              </View>
            ) : null}
          </View>

          {isInteractive ? (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityLabel={post.title ?? 'Community announcement'}
              style={({ pressed }) => [bubbleStyle, { opacity: pressed ? 0.94 : 1 }]}
            >
              {bubbleBody}
            </Pressable>
          ) : (
            <View style={bubbleStyle}>{bubbleBody}</View>
          )}

          {showTime && timeLabel ? (
            <Text style={[styles.time, { color: colors.text.tertiary }]}>{timeLabel}</Text>
          ) : null}

          <CommunityReactionBar
            reactionCounts={post.reactionCounts}
            myReactions={post.myReactions}
            onReact={onReact}
            readOnly={readOnly}
            compact
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  avatarSpacer: {
    width: 36,
  },
  stack: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleFeed: {
    maxWidth: '88%',
  },
  bubbleThread: {
    maxWidth: '100%',
  },
  stackFeed: {
    maxWidth: '88%',
  },
  stackThread: {
    maxWidth: '100%',
  },
  media: {
    borderRadius: 12,
    height: 180,
    marginTop: 4,
    width: '100%',
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    paddingLeft: 4,
  },
  unreadPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
