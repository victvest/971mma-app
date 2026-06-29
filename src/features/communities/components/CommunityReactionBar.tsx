import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export const COMMUNITY_REACTIONS = ['👍', '🔥', '💪', '❤️'] as const;

type CommunityReactionBarProps = {
  reactionCounts: Record<string, number>;
  myReactions: string[];
  onReact?: (emoji: string) => void;
  readOnly?: boolean;
  compact?: boolean;
};

export function CommunityReactionBar({
  reactionCounts,
  myReactions,
  onReact,
  readOnly = false,
  compact = false,
}: CommunityReactionBarProps) {
  const { colors, radius, gap } = useTheme();

  return (
    <View style={[styles.row, { gap: gap.xs }]}>
      {COMMUNITY_REACTIONS.map((emoji) => {
        const count = reactionCounts[emoji] ?? 0;
        const active = myReactions.includes(emoji);

        if (!readOnly && onReact) {
          return (
            <Pressable
              key={emoji}
              onPress={() => {
                triggerSelectionHaptic();
                onReact(emoji);
              }}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                {
                  backgroundColor: active ? colors.accent.subtle : colors.surface.primary,
                  borderColor: active ? colors.accent.default : colors.border.subtle,
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji}</Text>
              {count > 0 ? (
                <Text style={[styles.count, { color: colors.text.secondary }]}>{count}</Text>
              ) : null}
            </Pressable>
          );
        }

        if (count <= 0) return null;

        return (
          <View
            key={emoji}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              {
                backgroundColor: colors.surface.primary,
                borderColor: colors.border.subtle,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji}</Text>
            <Text style={[styles.count, { color: colors.text.secondary }]}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 8,
  },
  chipCompact: {
    minHeight: 24,
    paddingHorizontal: 6,
  },
  emoji: {
    fontSize: 14,
  },
  emojiCompact: {
    fontSize: 12,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
  },
});
