import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getCoachPrimaryRank,
  getCoachRatingLabel,
} from '@/features/coaches/components/CoachVisuals';
import { AnimatedCount } from '@/shared/components/detail';
import { UaeAccentBar } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';
import type { CoachItem } from '@/types/domain';

type Props = {
  coach: CoachItem;
  classCount: number;
  classesReady?: boolean;
};

export function CoachDetailStats({ coach, classCount, classesReady = true }: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const hasRating = coach.rating !== null && coach.rating !== undefined;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
        },
      ]}
    >
      <UaeAccentBar height={3} />
      <View style={[styles.row, { paddingVertical: inset.lg, paddingHorizontal: inset.md }]}>
        <View style={[styles.col, { gap: gap.xs }]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[typography.textPresets.metricValue, { color: colors.text.primary }]}
          >
            {getCoachPrimaryRank(coach)}
          </Text>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>Rank</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

        <View style={[styles.col, { gap: gap.xs }]}>
          {classesReady ? (
            <AnimatedCount
              value={classCount}
              duration={950}
              delay={260}
              style={[typography.textPresets.metricValue, styles.count, { color: colors.text.primary }]}
            />
          ) : (
            <Text style={[typography.textPresets.metricValue, { color: colors.text.tertiary }]}>—</Text>
          )}
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>Classes</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

        <View style={[styles.col, { gap: gap.xs }]}>
          {hasRating ? (
            <AnimatedCount
              value={coach.rating ?? 0}
              decimals={1}
              duration={950}
              delay={340}
              style={[typography.textPresets.metricValue, styles.count, { color: colors.text.primary }]}
            />
          ) : (
            <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
              {getCoachRatingLabel(coach)}
            </Text>
          )}
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>Rating</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  col: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  count: {
    minWidth: 0,
    textAlign: 'center',
  },
  divider: {
    alignSelf: 'stretch',
    marginHorizontal: 8,
    width: StyleSheet.hairlineWidth,
  },
});
