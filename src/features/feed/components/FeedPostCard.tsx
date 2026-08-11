import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { MotiPressable } from '@/shared/animations';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { FeedPost } from '@/features/feed/types';
import { formatCompactCount, formatRelativeTime } from '@/features/feed/utils/feedFormat';
import { FeedImageGrid } from './FeedImageGrid';
import { MemberAvatarWithCoachBadge } from './MemberAvatarWithCoachBadge';

type Props = {
  post: FeedPost;
  onLike: (post: FeedPost) => void;
  onOpenComments: (post: FeedPost) => void;
  onOpenAuthor: (userId: string) => void;
  onShare: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  actionsMode?: 'full' | 'comments-only' | 'none';
};

type ActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

function PostAction({ icon, activeIcon, label, active, destructive, onPress }: ActionProps) {
  const { colors, typography, gap } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    scale.value = withSequence(
      withSpring(1.22, { damping: 10, stiffness: 240 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = destructive
    ? colors.status.error
    : active
      ? colors.brand.red
      : colors.text.secondary;

  return (
    <MotiPressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, { gap: gap.xs }]}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={active && activeIcon ? activeIcon : icon} size={21} color={color} />
      </Animated.View>
      <Text style={[typography.textPresets.captionMedium, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </MotiPressable>
  );
}

export const FeedPostCard = memo(function FeedPostCard({
  post,
  onLike,
  onOpenComments,
  onOpenAuthor,
  onShare,
  onDelete,
  actionsMode = 'full',
}: Props) {
  const { colors, typography, inset, gap, radius, layout, surfaceShadow } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const canCollapse = post.body.length > 220;
  const timeLabel = useMemo(() => formatRelativeTime(post.publishedAt), [post.publishedAt]);
  const likeLabel = post.likeCount > 0 ? formatCompactCount(post.likeCount) : 'Like';
  const commentLabel = post.commentCount > 0 ? formatCompactCount(post.commentCount) : 'Comment';

  const handleLike = useCallback(() => {
    triggerLightImpact();
    onLike(post);
  }, [onLike, post]);

  const handleDoubleTap = useCallback(() => {
    if (actionsMode !== 'full') return;
    triggerLightImpact();
    if (!post.myLiked) onLike(post);
  }, [actionsMode, onLike, post]);

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(22).stiffness(190)}
      style={[
        styles.card,
        surfaceShadow('card'),
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          padding: inset.md,
          gap: gap.md,
        },
      ]}
    >
      <View style={[styles.header, { gap: gap.md }]}>
        <Pressable
          onPress={() => onOpenAuthor(post.authorId)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.authorName}`}
        >
          <MemberAvatarWithCoachBadge
            name={post.authorName}
            avatarUrl={post.authorAvatarUrl}
            size={46}
            showCoachBadge={post.isVerifiedCoach}
            backgroundColor={colors.accent.subtle}
            textColor={colors.accent.default}
          />
        </Pressable>
        <Pressable
          onPress={() => onOpenAuthor(post.authorId)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.authorName}`}
          style={styles.headerText}
        >
          <View style={[styles.nameRow, { gap: gap.xs }]}>
            <Text
              numberOfLines={1}
              style={[
                typography.textPresets.bodyStrong,
                styles.name,
                { color: colors.text.primary },
              ]}
            >
              {post.authorName}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[typography.textPresets.caption, { color: colors.text.tertiary }]}
          >
            {post.disciplineName} · {timeLabel}
          </Text>
        </Pressable>

        {post.canDelete && onDelete ? (
          <Pressable
            hitSlop={10}
            onPress={() => onDelete(post)}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            style={styles.moreButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      <Animated.View layout={LinearTransition.springify().damping(22).stiffness(190)}>
        <Text
          selectable
          numberOfLines={!expanded && canCollapse ? 4 : undefined}
          style={[typography.textPresets.body, { color: colors.text.primary }]}
        >
          {post.body}
        </Text>
        {canCollapse ? (
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show less' : 'Show full post'}
            style={styles.moreTextButton}
          >
            <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>
              {expanded ? 'Show less' : 'More'}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <FeedImageGrid media={post.media} onDoubleTap={handleDoubleTap} />

      {actionsMode !== 'none' ? (
        <View
          style={[styles.actions, { borderTopColor: colors.border.subtle, paddingTop: gap.sm }]}
        >
          {actionsMode === 'full' ? (
            <PostAction
              icon="heart-outline"
              activeIcon="heart"
              label={likeLabel}
              active={post.myLiked}
              onPress={handleLike}
            />
          ) : null}
          <PostAction
            icon="chatbubble-outline"
            label={commentLabel}
            onPress={() => onOpenComments(post)}
          />
          {actionsMode === 'full' ? (
            <PostAction icon="share-outline" label="Share" onPress={() => onShare(post)} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerText: {
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
  moreButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  moreTextButton: {
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 38,
    minWidth: 84,
    justifyContent: 'center',
  },
});
