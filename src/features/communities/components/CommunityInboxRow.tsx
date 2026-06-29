import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import {
  formatCommunityInboxTime,
} from '@/features/communities/components/community-chat-utils';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelItem } from '@/types/domain';

type CommunityInboxRowProps = {
  channel: CommunityChannelItem;
  onPress: () => void;
};

export function CommunityInboxRow({ channel, onPress }: CommunityInboxRowProps) {
  const { colors, typography, inset, gap, layout } = useTheme();
  const preview = useMemo(() => {
    if (channel.lastMessagePreview) return channel.lastMessagePreview;
    return 'No messages yet';
  }, [channel.lastMessagePreview]);

  const timeLabel = formatCommunityInboxTime(channel.lastMessageAt ?? channel.latestPostAt);
  const hasUnread = channel.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.title}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: hasUnread ? colors.accent.subtle : colors.background.primary,
          borderBottomColor: colors.border.subtle,
          borderBottomWidth: layout.borderWidth,
          gap: gap.md,
          opacity: pressed ? 0.88 : 1,
          paddingHorizontal: inset.lg,
          paddingVertical: inset.md,
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        <MemberAvatar
          name={channel.coachName}
          avatarUrl={channel.coachAvatarUrl}
          size={48}
          backgroundColor={colors.accent.default}
          textColor={colors.text.inverse}
        />
        {hasUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.status.error, borderColor: colors.background.primary }]} />
        ) : null}
      </View>

      <View style={[styles.copy, { gap: 4 }]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              hasUnread ? typography.textPresets.bodyStrong : typography.textPresets.body,
              { color: colors.text.primary, flex: 1 },
            ]}
            numberOfLines={1}
          >
            {channel.title}
          </Text>
          {timeLabel ? (
            <Text style={[styles.time, { color: hasUnread ? colors.accent.default : colors.text.tertiary }]}>
              {timeLabel}
            </Text>
          ) : null}
        </View>

        <Text
          style={[
            typography.textPresets.footnote,
            {
              color: hasUnread ? colors.text.primary : colors.text.secondary,
              fontWeight: hasUnread ? '600' : '500',
            },
          ]}
          numberOfLines={2}
        >
          {preview}
        </Text>

        <View style={[styles.metaRow, { gap: gap.sm }]}>
          <Text style={[styles.meta, { color: colors.text.tertiary }]} numberOfLines={1}>
            {channel.disciplineName}
          </Text>
          {hasUnread ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.accent.default }]}>
              <Text style={[styles.unreadCount, { color: colors.accent.onAccent }]}>
                {channel.unreadCount > 9 ? '9+' : channel.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  avatarWrap: {
    position: 'relative',
  },
  unreadDot: {
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -1,
    top: -1,
    width: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  meta: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  unreadBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  unreadCount: {
    fontSize: 10,
    fontWeight: '800',
  },
});
