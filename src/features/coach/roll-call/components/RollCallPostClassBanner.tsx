import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

export const RollCallPostClassBanner = memo(function RollCallPostClassBanner() {
  const { colors, inset, radius, typography, gap } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.status.warningSubtle,
          borderColor: colors.status.warningBorder,
          borderRadius: radius.card,
          padding: inset.md,
          gap: gap.xs,
        },
      ]}
    >
      <View style={[styles.row, { gap: gap.sm }]}>
        <Ionicons name="create-outline" size={18} color={colors.status.warning} />
        <Text style={[typography.textPresets.bodyStrong, { color: colors.status.warning, flex: 1 }]}>
          Post-class attendance correction
        </Text>
      </View>
      <Text style={[typography.textPresets.footnote, { color: colors.status.warning }]}>
        Tap a member to update status, including left early, until gym day ends.
      </Text>
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
