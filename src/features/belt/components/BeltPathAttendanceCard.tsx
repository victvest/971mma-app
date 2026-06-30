import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedBarFill, AnimatedProgressRing } from '@/shared/animations';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';

const ATTENDANCE_WINDOW_DAYS = 30;
const BAR_TRACK_HEIGHT = 48;
/** Consistent scale so bar height is comparable week to week (not relative to the max in view). */
const WEEKLY_SESSION_TARGET = 6;

type Props = {
  trainingDays30d: number;
  currentStreak: number;
  totalTrainingDays: number;
  weekCounts: number[];
};

function WeekActivityBars({
  counts,
  currentColor,
  pastColor,
  trackColor,
  trackBorderColor,
}: {
  counts: number[];
  currentColor: string;
  pastColor: string;
  trackColor: string;
  trackBorderColor: string;
}) {
  const { colors, typography, radius } = useTheme();
  const totalSessions = useMemo(() => counts.reduce((sum, count) => sum + count, 0), [counts]);
  const barRadius = radius.sm;

  return (
    <View style={styles.barChartRoot}>
      <View style={styles.barChartHeader}>
        <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
          {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} in 8 weeks
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          Goal: {WEEKLY_SESSION_TARGET}/wk
        </Text>
      </View>

      <View style={styles.barChartContainer}>
        {counts.map((count, idx) => {
          const percent = Math.min(100, (count / WEEKLY_SESSION_TARGET) * 100);
          const isCurrentWeek = idx === counts.length - 1;
          const weeksAgo = counts.length - 1 - idx;

          return (
            <View
              key={`week-${idx}`}
              style={[
                styles.barColumn,
                isCurrentWeek && {
                  backgroundColor: colors.accent.subtle,
                  borderRadius: radius.md,
                  paddingHorizontal: 2,
                  paddingTop: 4,
                  paddingBottom: 2,
                },
              ]}
              accessibilityLabel={
                isCurrentWeek
                  ? `This week, ${count} sessions`
                  : `${weeksAgo} weeks ago, ${count} sessions`
              }
            >
              {isCurrentWeek ? (
                <View style={[styles.nowBadge, { backgroundColor: colors.accent.default }]}>
                  <Text style={[styles.nowLabel, { color: colors.accent.onAccent }]}>Now</Text>
                </View>
              ) : (
                <View style={styles.nowSpacer} />
              )}

              <AnimatedBarFill
                percent={percent}
                backgroundColor={pastColor}
                highlightColor={currentColor}
                isHighlighted={isCurrentWeek}
                trackColor={trackColor}
                trackBorderColor={trackBorderColor}
                trackHeight={BAR_TRACK_HEIGHT}
                borderRadius={barRadius}
                minFillHeight={count > 0 ? 6 : 0}
              />

              <Text
                style={[
                  styles.countLabel,
                  typography.textPresets.captionMedium,
                  {
                    color:
                      count > 0
                        ? isCurrentWeek
                          ? currentColor
                          : colors.text.secondary
                        : colors.text.tertiary,
                    fontWeight: isCurrentWeek && count > 0 ? '800' : '600',
                  },
                ]}
              >
                {count}
              </Text>
            </View>
          );
        })}
      </View>
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
        <WeekActivityBars
          counts={weekCounts}
          currentColor={colors.accent.default}
          pastColor={colors.accent.pressed}
          trackColor={colors.fill.secondary}
          trackBorderColor={colors.border.subtle}
        />
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
  barChartRoot: {
    gap: 10,
  },
  barChartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barChartContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  nowBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nowLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  nowSpacer: {
    height: 16,
  },
  countLabel: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
});
