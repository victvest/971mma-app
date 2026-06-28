import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  completed: number;
  total: number;
};

export const RollCallProgress = memo(function RollCallProgress({ completed, total }: Props) {
  const { colors, radius, typography, gap } = useTheme();

  const safeTotal = Math.max(total, 1);
  const markedCount = Math.min(completed, safeTotal);
  const progress = useMemo(() => Math.min(markedCount / safeTotal, 1), [markedCount, safeTotal]);

  const countLabel = useMemo(
    () => `${markedCount} of ${safeTotal} marked`,
    [markedCount, safeTotal],
  );

  return (
    <View style={[styles.wrap, { gap: gap.sm }]}>
      <Text
        style={[typography.textPresets.metricLabel, styles.label, { color: colors.text.secondary }]}
        accessibilityRole="text"
      >
        {countLabel}
      </Text>

      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.fill.secondary,
            borderRadius: radius.pill,
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: safeTotal, now: markedCount }}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: colors.status.success,
              borderRadius: radius.pill,
            },
          ]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  label: {
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  track: {
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
});
