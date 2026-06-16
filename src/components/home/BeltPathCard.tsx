import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '../ProgressRing';
import { colors, fonts, palette, radii, shadow, spacing } from '../../theme';
import { UaeFlagIcon } from '../UaeFlagIcon';

type Props = {
  rank: string;
  stripes: number;
  percent: number;
  sessionsToNext: number;
  onPress?: () => void;
};

export function BeltPathCard({ rank, stripes, percent, sessionsToNext, onPress }: Props) {
  const size = 64;

  return (
    <Pressable onPress={onPress} style={[styles.card, shadow.card]} accessibilityRole="button">
      <View style={styles.left}>
        <View style={styles.labelRow}>
          <UaeFlagIcon width={16} height={11} />
          <Text style={styles.label}>BELT PATH</Text>
        </View>
        <Text style={styles.rank}>{rank} · Stripe {stripes}</Text>
        <Text style={styles.sub}>{sessionsToNext} sessions to stripe {stripes + 1}</Text>
      </View>
      <View style={styles.ring}>
        <ProgressRing size={size} stroke={6} value={percent} max={100} color={palette.greenBright} trackColor="rgba(255,255,255,0.15)" />
        <Text style={styles.pct}>{percent}%</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: palette.black,
    borderRadius: radii.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  left: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1 },
  rank: { fontFamily: fonts.displayBold, fontSize: 22, color: '#fff', marginTop: spacing.sm },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 },
  ring: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', fontFamily: fonts.displayBold, fontSize: 15, color: '#fff' },
});
