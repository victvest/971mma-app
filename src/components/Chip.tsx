import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, glow, palette, radii, spacing } from '../theme';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'green' | 'red' | 'ink';
};

export function Chip({ label, active, onPress, tone = 'green' }: Props) {
  const grad: readonly [string, string, ...string[]] =
    tone === 'red' ? [palette.red, palette.redDeep] : [palette.green, palette.greenDeep];

  if (active) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={[styles.shell, glow.green]}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
          <Text style={[styles.label, { color: '#fff' }]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.chip, styles.idle]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radii.pill },
  chip: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: palette.glass08,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  label: { fontFamily: fonts.semi, fontSize: 13.5, letterSpacing: 0.2 },
});
