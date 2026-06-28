import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type Props = {
  presentCount: number;
};

export const RollCallCompletedBanner = memo(function RollCallCompletedBanner({ presentCount }: Props) {
  const { colors, inset, radius, typography, gap } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.status.successSubtle,
          borderColor: colors.status.successBorder,
          borderRadius: radius.card,
          padding: inset.md,
          gap: gap.xs,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Roll call completed, ${presentCount} present`}
    >
      <View style={[styles.row, { gap: gap.sm }]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.status.success} />
        <Text style={[typography.textPresets.bodyStrong, { color: colors.status.success, flex: 1 }]}>
          Roll call completed · {presentCount} present
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
