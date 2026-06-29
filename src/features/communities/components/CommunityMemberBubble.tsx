import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import {
  COMMUNITY_CHAT_BUBBLE,
  formatCommunityMessageTime,
} from '@/features/communities/components/community-chat-utils';
import { useTheme } from '@/shared/theme';
import type { CommunityReplyItem } from '@/types/domain';

type CommunityMemberBubbleProps = {
  reply: CommunityReplyItem;
};

/** Right-aligned member reply bubble — chat-bot conversation style. */
export function CommunityMemberBubble({ reply }: CommunityMemberBubbleProps) {
  const { colors, typography, gap } = useTheme();
  const timeLabel = formatCommunityMessageTime(reply.createdAt);

  return (
    <View style={[styles.row, { gap: gap.sm }]}>
      <View style={[styles.stack, { gap: gap.xs }]}>
        <View style={[styles.metaRow, { gap: gap.xs }]}>
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]} numberOfLines={1}>
            {reply.authorName}
          </Text>
          {timeLabel ? (
            <Text style={[styles.time, { color: colors.text.tertiary }]}>{timeLabel}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.bubble,
            COMMUNITY_CHAT_BUBBLE.member,
            {
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.subtle,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Text
            selectable
            style={[typography.textPresets.body, { color: colors.text.primary, lineHeight: 21 }]}
          >
            {reply.body}
          </Text>
        </View>
      </View>

      <MemberAvatar
        name={reply.authorName}
        avatarUrl={reply.authorAvatarUrl}
        size={32}
        backgroundColor={colors.fill.primary}
        textColor={colors.text.inverse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  stack: {
    alignItems: 'flex-end',
    maxWidth: '82%',
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    paddingRight: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
  },
});
