import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RollCallSummary } from '@/features/coach/roll-call/types';
import { useTheme } from '@/shared/theme';

type Props = {
  summary: RollCallSummary;
};

type StatSpec = {
  key: string;
  label: string;
  value: number;
  accentColor: string;
};

const LATE_ACCENT = '#F59E0B';

const RollCallSummaryStat = memo(function RollCallSummaryStat({
  label,
  value,
  accentColor,
}: Omit<StatSpec, 'key'>) {
  const { colors, radius, typography, inset } = useTheme();

  return (
    <View
      style={[
        styles.stat,
        {
          borderRadius: radius.card,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          paddingHorizontal: inset.sm,
          paddingVertical: inset.sm,
          gap: 4,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={[typography.textPresets.metricLabel, { color: colors.text.secondary }]}>
        {label}
      </Text>
      <Text style={[typography.textPresets.metricValue, { color: accentColor }]}>{value}</Text>
    </View>
  );
});

export const RollCallSummaryStats = memo(function RollCallSummaryStats({ summary }: Props) {
  const { colors, gap, inset, radius, typography } = useTheme();

  const stats = useMemo(
    (): StatSpec[] => [
      { key: 'present', label: 'Present', value: summary.present, accentColor: colors.accent.default },
      { key: 'late', label: 'Late', value: summary.late, accentColor: LATE_ACCENT },
      { key: 'absent', label: 'Absent', value: summary.absent, accentColor: colors.status.error },
    ],
    [colors.accent.default, colors.status.error, summary.absent, summary.late, summary.present],
  );

  return (
    <View style={{ gap: gap.sm }}>
      <View style={[styles.grid, { gap: gap.sm }]}>
        {stats.map((stat) => (
          <RollCallSummaryStat
            key={stat.key}
            label={stat.label}
            value={stat.value}
            accentColor={stat.accentColor}
          />
        ))}
      </View>
      <View style={styles.sessionPillWrap}>
        <View
          style={[
            styles.sessionPill,
            {
              borderRadius: radius.pill,
              backgroundColor: colors.fill.secondary,
              paddingHorizontal: inset.md,
              paddingVertical: 6,
              gap: gap.xs,
            },
          ]}
        >
          <View
            style={[
              styles.sessionDot,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
              },
            ]}
          />
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.primary }]}>
            {summary.sessionCount} in session
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
  },
  sessionPillWrap: {
    alignItems: 'center',
  },
  sessionPill: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sessionDot: {
    height: 8,
    width: 8,
  },
});
