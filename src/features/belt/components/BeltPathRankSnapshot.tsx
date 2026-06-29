import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedProgressRing } from '@/shared/animations';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';
import type { BeltProgressItem } from '@/types/domain';

type Props = {
  progress: BeltProgressItem;
};

export function BeltPathRankSnapshot({ progress }: Props) {
  const { colors, typography, gap, inset } = useTheme();
  const stripeLabel =
    progress.maxStripes > 0
      ? `${progress.stripe} of ${progress.maxStripes} stripes`
      : `${progress.stripe} stripes`;
  const ringPercent = Math.min(100, Math.max(0, progress.percent));

  return (
    <BeltPathSurfaceCard style={{ gap: gap.lg, marginBottom: gap.lg }}>
      <View style={styles.headerRow}>
        <View style={[styles.copy, { gap: gap.xs }]}>
          <Text style={[styles.kicker, { color: colors.accent.default }]}>CURRENT RANK</Text>
          <Text style={[typography.textPresets.title, styles.rankName, { color: colors.text.primary }]}>
            {progress.rankName}
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>{stripeLabel}</Text>
        </View>

        <AnimatedProgressRing
          size={72}
          strokeWidth={5}
          percent={ringPercent}
          trackColor={colors.fill.secondary}
          progressColor={colors.accent.default}
        >
          <Text style={[styles.ringValue, { color: colors.text.primary }]}>{Math.round(ringPercent)}%</Text>
        </AnimatedProgressRing>
      </View>

      <View
        style={[
          styles.noteRow,
          {
            backgroundColor: colors.accent.subtle,
            borderRadius: inset.sm,
            gap: gap.sm,
            padding: inset.sm,
          },
        ]}
      >
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary, flex: 1, lineHeight: 18 }]}>
          Stripe requirements for your rank are being configured. Keep training — your attendance is already being
          tracked below.
        </Text>
      </View>
    </BeltPathSurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  rankName: {
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  ringValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  noteRow: {},
});
