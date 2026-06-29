import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { buildCommunityPreview } from '@/features/communities/components/community-chat-utils';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type CommunityAnnouncementBannerProps = {
  post: CommunityPostItem;
  onPress?: () => void;
};

export function CommunityAnnouncementBanner({ post, onPress }: CommunityAnnouncementBannerProps) {
  const { colors, typography, inset, gap, radius, layout, shadows } = useTheme();
  const preview = buildCommunityPreview(post.title, post.body, 96);

  return (
    <Pressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress?.();
      }}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Pinned announcement: ${preview}`}
      style={({ pressed }) => [
        styles.banner,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.accent.default,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          gap: gap.sm,
          opacity: pressed && onPress ? 0.92 : 1,
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm + 2,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent.subtle }]}>
        <Ionicons name="megaphone" size={16} color={colors.accent.default} />
      </View>

      <View style={styles.copy}>
        <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>
          Pinned announcement
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.primary }]} numberOfLines={2}>
          {preview}
        </Text>
      </View>

      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
