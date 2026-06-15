import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { GlassCard } from '../../ui';
import { colors, fonts, palette, spacing } from '../../theme';

type Props = {
  points: number;
  pointsToNext: number;
  nextTier: string;
  onPass: () => void;
  onRewards: () => void;
};

export function QuickPassRow({ points, pointsToNext, nextTier, onPass, onRewards }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPass} style={styles.flex} accessibilityRole="button">
        <GlassCard style={styles.card}>
          <View style={styles.inner}>
            <View style={styles.iconGreen}>
              <Icon source="qrcode" size={22} color={palette.green} />
            </View>
            <Text variant="titleMedium" style={styles.title}>QR pass</Text>
            <Text variant="bodySmall" style={styles.sub}>Active · tap to scan in</Text>
          </View>
        </GlassCard>
      </Pressable>
      <Pressable onPress={onRewards} style={styles.flex} accessibilityRole="button">
        <GlassCard style={styles.card}>
          <View style={styles.inner}>
            <View style={styles.iconGold}>
              <Icon source="gift-outline" size={22} color={palette.goldDeep} />
            </View>
            <Text variant="titleMedium" style={styles.title}>{points.toLocaleString()} pts</Text>
            <Text variant="bodySmall" style={styles.sub}>{pointsToNext} to {nextTier}</Text>
          </View>
        </GlassCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  flex: { flex: 1 },
  card: { flex: 1 },
  inner: { padding: spacing.lg },
  iconGreen: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.greenGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconGold: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.goldGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.bold, color: colors.text },
  sub: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 4 },
});
