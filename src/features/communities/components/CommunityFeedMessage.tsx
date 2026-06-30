import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CommunityChatBubble } from '@/features/communities/components/CommunityChatBubble';
import { CommunityReplyPreview } from '@/features/communities/components/CommunityReplyPreview';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type CommunityFeedMessageProps = {
  post: CommunityPostItem;
  onPress?: () => void;
  onLongPress?: () => void;
  onOpenThread?: () => void;
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
};

/** Coach announcement in the group feed with optional thread preview. */
export function CommunityFeedMessage({
  post,
  onPress,
  onLongPress,
  onOpenThread,
  onReact,
  readOnly = false,
}: CommunityFeedMessageProps) {
  const { gap, inset } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.xs, paddingHorizontal: inset.md }]}>
      <CommunityChatBubble
        post={post}
        variant="feed"
        showAvatar
        onPress={onPress}
        onLongPress={onLongPress}
        onReact={onReact}
        readOnly={readOnly}
      />
      <CommunityReplyPreview replyCount={post.replyCount} onPress={onOpenThread ?? onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
