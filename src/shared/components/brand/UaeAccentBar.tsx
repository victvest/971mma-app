import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  height?: number;
};

/** UAE flag tri-stripe accent — green, white, black (strategic brand moment). */
export function UaeAccentBar({ height = 3 }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.segment, { backgroundColor: colors.accent.default }]} />
      <View style={[styles.segment, { backgroundColor: colors.surface.primary }]} />
      <View style={[styles.segment, { backgroundColor: colors.status.error }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  segment: {
    flex: 1,
  },
});
