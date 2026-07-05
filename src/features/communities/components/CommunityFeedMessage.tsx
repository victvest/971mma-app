import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CommunityChatBubble } from '@/features/communities/components/CommunityChatBubble';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type CommunityFeedMessageProps = {
  post: CommunityPostItem;
  onPress?: () => void;
  onLongPress?: () => void;
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
};

export function CommunityFeedMessage({
  post,
  onPress,
  onLongPress,
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
