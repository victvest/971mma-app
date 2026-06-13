import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../theme';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'green' | 'red' | 'ink';
};

export function Chip({ label, active, onPress, tone = 'green' }: Props) {
  const activeBg =
    tone === 'red' ? colors.danger : tone === 'ink' ? colors.text : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: activeBg, borderColor: activeBg } : styles.idle,
      ]}
    >
      <Text style={[styles.label, { color: active ? '#fff' : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  label: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
});
