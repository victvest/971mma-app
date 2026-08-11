import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';
import type { FeedComment } from '@/features/feed/types';
import { formatRelativeTime } from '@/features/feed/utils/feedFormat';
import { MemberAvatarWithCoachBadge } from './MemberAvatarWithCoachBadge';

type Props = {
  comment: FeedComment;
  onOpenAuthor?: (userId: string) => void;
  onDelete?: (comment: FeedComment) => void;
};

export const FeedCommentRow = memo(function FeedCommentRow({
  comment,
  onOpenAuthor,
  onDelete,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();

  return (
    <View style={[styles.row, { gap: gap.md }]}>
      <Pressable disabled={!onOpenAuthor} onPress={() => onOpenAuthor?.(comment.authorId)}>
        <MemberAvatarWithCoachBadge
          name={comment.authorName}
          avatarUrl={comment.authorAvatarUrl}
          size={38}
          showCoachBadge={comment.isVerifiedCoach}
          backgroundColor={colors.accent.subtle}
          textColor={colors.accent.default}
        />
      </Pressable>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.subtle,
            borderRadius: radius.card,
            borderWidth: layout.borderWidth,
            paddingHorizontal: inset.md,
            paddingVertical: inset.sm,
            gap: gap.xs,
          },
        ]}
      >
        <View style={[styles.header, { gap: gap.xs }]}>
          <Text
            numberOfLines={1}
            style={[
              typography.textPresets.captionMedium,
              styles.name,
              { color: colors.text.primary },
            ]}
          >
            {comment.authorName}
          </Text>
          <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
          {comment.canDelete && onDelete ? (
            <Pressable
              hitSlop={10}
              onPress={() => onDelete(comment)}
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={15} color={colors.text.tertiary} />
            </Pressable>
          ) : null}
        </View>
        <Text selectable style={[typography.textPresets.footnote, { color: colors.text.primary }]}>
          {comment.body}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  bubble: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
  deleteButton: {
    marginLeft: 'auto',
  },
});
