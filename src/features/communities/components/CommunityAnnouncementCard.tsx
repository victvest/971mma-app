import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CommunityChatBubble } from '@/features/communities/components/CommunityChatBubble';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type CommunityAnnouncementCardProps = {
  post: CommunityPostItem;
  onPress?: () => void;
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
};

/** Expanded coach announcement — same bot bubble, full thread width. */
export function CommunityAnnouncementCard({
  post,
  onPress,
  onReact,
  readOnly = false,
}: CommunityAnnouncementCardProps) {
  const { inset } = useTheme();

  return (
    <View style={[styles.wrap, { paddingHorizontal: inset.md }]}>
      <CommunityChatBubble
        post={post}
        variant={post.isPinned ? 'pinned' : 'thread'}
        showAvatar
        onPress={onPress}
        onReact={onReact}
        readOnly={readOnly}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
