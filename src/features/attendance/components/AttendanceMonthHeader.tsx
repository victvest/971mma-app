import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  label: string;
};

/** Month section header for attendance history (Nike / Apple Fitness pattern). */
export const AttendanceMonthHeader = memo(function AttendanceMonthHeader({ label }: Props) {
  const { colors, typography, inset } = useTheme();

  return (
    <View
      style={[styles.wrap, { paddingTop: inset.md, paddingBottom: inset.sm }]}
      accessibilityRole="header"
    >
      <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
