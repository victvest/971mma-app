import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, radii, shadow, spacing } from '../../theme';

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
      <Pressable onPress={onPass} style={[styles.card, shadow.soft]} accessibilityRole="button">
        <View style={styles.iconGreen}>
          <Ionicons name="qr-code" size={22} color={palette.green} />
        </View>
        <Text style={styles.title}>QR pass</Text>
        <Text style={styles.sub}>Active · tap to scan in</Text>
      </Pressable>
      <Pressable onPress={onRewards} style={[styles.card, shadow.soft]} accessibilityRole="button">
        <View style={styles.iconGold}>
          <Ionicons name="gift-outline" size={22} color={palette.goldDeep} />
        </View>
        <Text style={styles.title}>{points.toLocaleString()} pts</Text>
        <Text style={styles.sub}>{pointsToNext} to {nextTier}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.lg,
  },
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
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
