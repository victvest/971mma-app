import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type CommunityReplyPreviewProps = {
  replyCount: number;
  latestAuthorName?: string | null;
  onPress?: () => void;
};

export function CommunityReplyPreview({
  replyCount,
  latestAuthorName,
  onPress,
}: CommunityReplyPreviewProps) {
  const { colors, typography, gap, radius, inset } = useTheme();

  if (replyCount <= 0) return null;

  const label =
    replyCount === 1
      ? latestAuthorName
        ? `${latestAuthorName} replied`
        : '1 reply'
      : `${replyCount} replies`;

  const content = (
    <View style={[styles.row, { gap: gap.xs }]}>
      <View style={[styles.miniBubble, { backgroundColor: colors.fill.secondary, borderRadius: radius.pill }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.text.tertiary} />
      </View>
      <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>{label}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={12} color={colors.accent.default} /> : null}
    </View>
  );

  if (!onPress) {
    return <View style={{ paddingLeft: inset.md + 36 }}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open thread, ${label}`}
      style={{ paddingLeft: inset.md + 36 }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  miniBubble: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
});
