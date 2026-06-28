import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedBarFill, AnimatedProgressRing } from '@/shared/animations';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';

const ATTENDANCE_WINDOW_DAYS = 30;

type Props = {
  trainingDays30d: number;
  currentStreak: number;
  totalTrainingDays: number;
  weekCounts: number[];
};

function WeekActivityBars({
  counts,
  currentColor,
  mutedColor,
  emptyColor,
}: {
  counts: number[];
  currentColor: string;
  mutedColor: string;
  emptyColor: string;
}) {
  const maxCount = Math.max(...counts, 1);

  return (
    <View style={styles.barChartContainer}>
      {counts.map((count, idx) => {
        const height = count > 0 ? Math.round((count / maxCount) * 100) : 0;
        const isCurrentWeek = idx === counts.length - 1;

        return (
          <View key={`${idx}-${count}`} style={styles.barContainer}>
            {isCurrentWeek && count > 0 ? (
              <Text style={[styles.nowLabel, { color: currentColor }]}>Now</Text>
            ) : (
              <View style={styles.nowSpacer} />
            )}
            <AnimatedBarFill
              percent={height}
              backgroundColor={mutedColor}
              highlightColor={currentColor}
              isHighlighted={isCurrentWeek}
              trackColor={emptyColor}
            />
          </View>
        );
      })}
    </View>
  );
}

export function BeltPathAttendanceCard({
  trainingDays30d,
  currentStreak,
  totalTrainingDays,
  weekCounts,
}: Props) {
  const { colors, typography, gap, layout, inset } = useTheme();
  const ringPercent = Math.min(100, (trainingDays30d / ATTENDANCE_WINDOW_DAYS) * 100);
  const hasWeeklyActivity = weekCounts.some((count) => count > 0);

  return (
    <BeltPathSurfaceCard style={{ gap: gap.lg, marginBottom: gap.lg }}>
      <Text style={[typography.textPresets.subtitle, styles.cardTitle, { color: colors.text.primary }]}>
        Attendance
      </Text>

      <View style={styles.progressRow}>
        <AnimatedProgressRing
          size={80}
          strokeWidth={6.5}
          percent={ringPercent}
          trackColor={colors.fill.secondary}
          progressColor={colors.accent.default}
        >
          <View style={styles.ringCenter}>
            <Text style={[styles.ringCount, { color: colors.text.primary }]}>{trainingDays30d}</Text>
            <Text style={[styles.ringSub, { color: colors.text.tertiary }]}>/ {ATTENDANCE_WINDOW_DAYS}D</Text>
          </View>
        </AnimatedProgressRing>

        <View style={[styles.detailsCol, { gap: gap.sm }]}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            {trainingDays30d > 0 ? `${trainingDays30d} training days` : 'No training days yet'}
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            Streak:{' '}
            <Text style={{ color: colors.accent.default, fontWeight: '800' }}>{currentStreak}</Text>
            {currentStreak > 0 ? ' 🔥' : ''}
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
            Total: {totalTrainingDays}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.consistencySection,
          {
            gap: gap.sm,
            paddingTop: inset.md,
            borderTopColor: colors.border.subtle,
            borderTopWidth: layout.borderWidth,
          },
        ]}
      >
        <Text style={[styles.consistencyKicker, { color: colors.text.tertiary }]}>LAST 8 WEEKS</Text>
        {hasWeeklyActivity ? (
          <WeekActivityBars
            counts={weekCounts}
            currentColor={colors.accent.default}
            mutedColor={colors.fill.secondary}
            emptyColor={colors.background.secondary}
          />
        ) : (
          <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
            Weekly activity will appear after your first sessions.
          </Text>
        )}
      </View>
    </BeltPathSurfaceCard>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCount: {
    fontSize: 20,
    fontWeight: '900',
  },
  ringSub: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  detailsCol: {
    flex: 1,
  },
  consistencySection: {},
  consistencyKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  barChartContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  nowLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  nowSpacer: {
    height: 13,
    marginBottom: 4,
  },
});
