import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CommunityAnnouncementCard } from '@/features/communities/components/CommunityAnnouncementCard';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type CommunityPinnedListProps = {
  posts: CommunityPostItem[];
  onSelectPost?: (postId: string) => void;
  readOnly?: boolean;
};

export function CommunityPinnedList({ posts, onSelectPost, readOnly = false }: CommunityPinnedListProps) {
  const { colors, typography, inset, gap } = useTheme();

  if (posts.length === 0) {
    return (
      <View style={[styles.empty, { padding: inset.lg }]}>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          No pinned announcements yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { gap: gap.lg, paddingVertical: inset.md }]}>
      {posts.map((post) => (
        <CommunityAnnouncementCard
          key={post.id}
          post={post}
          readOnly={readOnly}
          onPress={onSelectPost ? () => onSelectPost(post.id) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    width: '100%',
  },
});
