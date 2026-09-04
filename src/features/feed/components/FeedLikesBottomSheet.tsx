import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppBottomSheet } from '@/shared/components/AppBottomSheet';
import { useTheme } from '@/shared/theme';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useFeedPostLikes } from '@/features/feed/hooks/useFeed';
import type { FeedLikeUser } from '@/features/feed/types';
import { formatFeedBeltLine, formatRelativeTime } from '@/features/feed/utils/feedFormat';
import { MemberAvatarWithCoachBadge } from './MemberAvatarWithCoachBadge';

type Props = {
  postId: string | null;
  visible: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
};

type LikeUserRowProps = {
  user: FeedLikeUser;
  onPress: (userId: string) => void;
};

const LikeUserRow = memo(function LikeUserRow({ user, onPress }: LikeUserRowProps) {
  const { colors, typography, gap, radius, layout, inset } = useTheme();
  const beltLine = formatFeedBeltLine(user.beltRank, user.beltStripes);
  const timeAgo = formatRelativeTime(user.likedAt);

  const subline = [beltLine, timeAgo].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress(user.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open profile for ${user.name}`}
      style={({ pressed }) => [
        styles.userRow,
        {
          opacity: pressed ? 0.72 : 1,
          borderRadius: radius.card,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          backgroundColor: colors.surface.primary,
          padding: inset.sm + 2,
          gap: gap.md,
        },
      ]}
    >
      <MemberAvatarWithCoachBadge
        name={user.name}
        avatarUrl={user.avatarUrl}
        size={42}
        showCoachBadge={user.isVerifiedCoach}
        backgroundColor={colors.accent.subtle}
        textColor={colors.accent.default}
      />
      <View style={styles.textBlock}>
        <View style={[styles.nameRow, { gap: gap.xs }]}>
          <Text
            numberOfLines={1}
            style={[typography.textPresets.bodyStrong, { color: colors.text.primary, flexShrink: 1 }]}
          >
            {user.name}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[typography.textPresets.caption, { color: colors.text.tertiary }]}
        >
          {subline || 'Liked post'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
});

export const FeedLikesBottomSheet = memo(function FeedLikesBottomSheet({
  postId,
  visible,
  onClose,
  onSelectUser,
}: Props) {
  const { colors, typography, gap, inset, radius } = useTheme();
  const { height } = useWindowDimensions();
  const maxHeight = Math.min(height * 0.65, 520);

  const { data: likes = [], isLoading, isError, refetch } = useFeedPostLikes(visible ? postId : null);

  const handleSelectUser = useCallback(
    (userId: string) => {
      triggerLightImpact();
      onClose();
      onSelectUser(userId);
    },
    [onClose, onSelectUser],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedLikeUser }) => (
      <LikeUserRow user={item} onPress={handleSelectUser} />
    ),
    [handleSelectUser],
  );

  return (
    <AppBottomSheet visible={visible} onDismiss={onClose}>
      <View style={[styles.container, { maxHeight }]}>
        {/* Header */}
        <View style={[styles.header, { gap: gap.sm, paddingBottom: inset.xs }]}>
          <View style={[styles.titleRow, { gap: gap.xs }]}>
            <Ionicons name="heart" size={20} color={colors.brand.red} />
            <Text style={[typography.textPresets.subtitle, { color: colors.text.primary }]}>
              Likes
            </Text>
            {likes.length > 0 ? (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.accent.subtle, borderRadius: radius.pill },
                ]}
              >
                <Text
                  style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}
                >
                  {likes.length}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={[styles.centered, { paddingVertical: 36, gap: gap.md }]}>
            <ActivityIndicator size="small" color={colors.accent.default} />
            <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
              Loading likes…
            </Text>
          </View>
        ) : isError ? (
          <View style={[styles.centered, { paddingVertical: 32, gap: gap.sm }]}>
            <Text style={[typography.textPresets.body, { color: colors.status.error }]}>
              Could not load likes
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={[
                styles.retryButton,
                { backgroundColor: colors.accent.subtle, borderRadius: radius.pill },
              ]}
            >
              <Text
                style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : likes.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 40, gap: gap.xs }]}>
            <Ionicons name="heart-outline" size={36} color={colors.text.tertiary} />
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              No likes yet
            </Text>
            <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
              Be the first to show some support!
            </Text>
          </View>
        ) : (
          <FlatList
            data={likes}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { gap: gap.sm }]}
          />
        )}
      </View>
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 4,
  },
  userRow: {
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
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
});
