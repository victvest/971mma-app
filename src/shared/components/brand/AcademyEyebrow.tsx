import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UaeFlagMark } from '@/shared/components/brand/UaeFlagMark';
import { useTheme } from '@/shared/theme';

type Props = {
  label?: string;
  accent?: boolean;
  /** Light text for use over dark media scrims */
  onDark?: boolean;
  /** When false, renders label only (no UAE flag). */
  showFlag?: boolean;
};

export function AcademyEyebrow({
  label = '971 MMA · Dubai',
  accent = false,
  onDark = false,
  showFlag = true,
}: Props) {
  const { colors } = useTheme();

  const labelColor = accent
    ? onDark
      ? colors.accent.default
      : colors.accent.default
    : onDark
      ? 'rgba(255,255,255,0.72)'
      : colors.text.tertiary;

  return (
    <View style={styles.row}>
      {showFlag ? <UaeFlagMark /> : null}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
});
