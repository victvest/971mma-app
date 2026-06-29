import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type CommunityOwnerBadgeProps = {
  compact?: boolean;
};

export function CommunityOwnerBadge({ compact = false }: CommunityOwnerBadgeProps) {
  const { colors, typography, radius, inset } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.accent.subtle,
          borderColor: colors.accent.default,
          borderRadius: radius.badge,
          paddingHorizontal: compact ? 6 : inset.xs + 2,
          paddingVertical: compact ? 2 : 3,
          gap: compact ? 3 : 4,
        },
      ]}
    >
      <Ionicons name="shield-checkmark" size={compact ? 10 : 11} color={colors.accent.default} />
      <Text
        style={[
          compact ? styles.compactLabel : typography.textPresets.captionMedium,
          { color: colors.accent.default },
        ]}
      >
        Coach
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  compactLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
