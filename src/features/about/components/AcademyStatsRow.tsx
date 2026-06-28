import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ACADEMY_STATS } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function AcademyStatsRow() {
  const { colors, gap } = useTheme();

  return (
    <RevealOnMount delay={40} style={[styles.row, { gap: gap.sm }]}>
      {ACADEMY_STATS.map((stat) => (
        <AboutContentCard key={stat.label} style={styles.cell}>
          <View style={styles.cellInner}>
            <Text style={[styles.value, { color: colors.accent.default }]}>{stat.value}</Text>
            <Text style={[styles.label, { color: colors.text.tertiary }]} numberOfLines={2}>
              {stat.label}
            </Text>
          </View>
        </AboutContentCard>
      ))}
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    flexGrow: 1,
    width: '47%',
  },
  cellInner: {
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
