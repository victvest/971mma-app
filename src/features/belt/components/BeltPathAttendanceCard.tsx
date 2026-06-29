import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedBarFill, AnimatedProgressRing } from '@/shared/animations';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';

const ATTENDANCE_WINDOW_DAYS = 30;
const BAR_TRACK_HEIGHT = 40;

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
}: {
  counts: number[];
  currentColor: string;
  pastColor: string;
  trackColor: string;
}) {
  const { colors, typography } = useTheme();
  const maxCount = Math.max(...counts, 1);
  const totalSessions = useMemo(() => counts.reduce((sum, count) => sum + count, 0), [counts]);

  return (
    <View style={styles.barChartRoot}>
      <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
        {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} in 8 weeks
      </Text>
      <View style={styles.barChartContainer}>
        {counts.map((count, idx) => {
          const height = count > 0 ? Math.round((count / maxCount) * 100) : 0;
          const isCurrentWeek = idx === counts.length - 1;

          return (
            <View key={`week-${idx}`} style={styles.barColumn}>
              {isCurrentWeek ? (
                <Text style={[styles.nowLabel, { color: currentColor }]}>Now</Text>
              ) : (
                <View style={styles.nowSpacer} />
              )}
              <AnimatedBarFill
                percent={height}
                backgroundColor={pastColor}
                highlightColor={currentColor}
                isHighlighted={isCurrentWeek}
                trackColor={trackColor}
                trackHeight={BAR_TRACK_HEIGHT}
              />
              <Text
                style={[
                  styles.countLabel,
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
          trackColor={colors.accent.subtle}
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
    gap: 8,
  },
  barChartContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  nowLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nowSpacer: {
    height: 13,
  },
  countLabel: {
    fontSize: 10,
    letterSpacing: -0.1,
  },
});
