import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CommunityMemberBubble } from '@/features/communities/components/CommunityMemberBubble';
import { useTheme } from '@/shared/theme';
import type { CommunityReplyItem } from '@/types/domain';

type CommunityReplyRowProps = {
  reply: CommunityReplyItem;
};

export function CommunityReplyRow({ reply }: CommunityReplyRowProps) {
  const { inset } = useTheme();

  return (
    <View style={[styles.wrap, { paddingHorizontal: inset.md }]}>
      <CommunityMemberBubble reply={reply} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
