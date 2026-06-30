import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/theme';

export function UaeFlagMark() {
  const { colors, layout, radii } = useTheme();

  return (
    <View
      accessibilityLabel="United Arab Emirates flag"
      style={[
        styles.flag,
        {
          width: layout.academyFlagWidth,
          height: layout.academyFlagHeight,
          borderRadius: radii.xs,
          borderWidth: layout.borderWidth,
          borderColor: colors.border.default,
        },
      ]}
    >
      <View style={[styles.flagRed, { backgroundColor: colors.brand.red }]} />
      <View style={styles.flagStripes}>
        <View style={[styles.flagStripe, { backgroundColor: colors.accent.default }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.surface.primary }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.fill.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flag: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  flagRed: {
    flex: 1,
  },
  flagStripes: {
    flex: 3,
  },
  flagStripe: {
    flex: 1,
  },
});
