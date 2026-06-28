import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { RevealOnMount } from '@/shared/animations/RevealOnMount';
import { AnimatedProgressRing } from '@/shared/animations';
import { useTheme } from '@/shared/theme';
import type { DisciplineScoreSummary, GymDayActivity } from '@/types/domain';

type DisciplineHeroProps = {
  score: DisciplineScoreSummary | undefined;
  weekActivity: GymDayActivity[] | undefined;
};

type DayState = 'trained' | 'today' | 'missed' | 'future';

function getGymDateKey(date: Date): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dubaiTime = new Date(utc + 3600000 * 4);
  const y = dubaiTime.getFullYear();
  const m = (dubaiTime.getMonth() + 1).toString().padStart(2, '0');
  const d = dubaiTime.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DayPipProps = {
  label: string;
  state: DayState;
};

const DisciplineDayPip = memo(function DisciplineDayPip({ label, state }: DayPipProps) {
  const { colors, typography, layout } = useTheme();

  const isTrained = state === 'trained';
  const isToday = state === 'today';
  const isFuture = state === 'future';

  const dotBackground = isTrained
    ? colors.accent.default
    : isToday
      ? colors.accent.subtle
      : isFuture
        ? 'transparent'
        : colors.fill.secondary;

  const dotBorder = isTrained
    ? colors.accent.default
    : isToday
      ? colors.accent.default
      : colors.border.subtle;

  const labelColor = isTrained || isToday ? colors.accent.default : colors.text.tertiary;

  return (
    <View style={styles.dayItem}>
      <View
        style={[
          styles.dayDot,
          {
            backgroundColor: dotBackground,
            borderColor: dotBorder,
            borderWidth: isTrained ? 0 : layout.borderWidthStrong,
            opacity: isFuture ? 0.45 : 1,
          },
        ]}
      >
        {isTrained ? (
          <Check size={12} color={colors.text.onAccent} strokeWidth={3} />
        ) : isToday ? (
          <View style={[styles.todayCore, { backgroundColor: colors.accent.default }]} />
        ) : null}
      </View>
      <Text
        style={[
          typography.textPresets.captionMedium,
          {
            color: labelColor,
            fontWeight: isToday || isTrained ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});

export function DisciplineHero({ score, weekActivity }: DisciplineHeroProps) {
  const { colors, inset, gap, typography, radius, shadows, layout } = useTheme();

  const calendarWeek = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    const days = [];
    const todayStr = getGymDateKey(now);

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = getGymDateKey(dayDate);
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      days.push({
        date: dateStr,
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]!,
        isFuture,
        isToday,
      });
    }
    return days;
  }, []);

  const trainedDaysMap = useMemo(() => {
    const map = new Set<string>();
    if (weekActivity) {
      for (const item of weekActivity) {
        if (item.trained) {
          map.add(item.date);
        }
      }
    }
    return map;
  }, [weekActivity]);

  const currentMonthCount = score?.trainingDays30d ?? 0;
  const monthlyGoal = 20;
  const goalPercent = Math.min(Math.round((currentMonthCount / monthlyGoal) * 100), 100);

  const weeklySessionsCount = useMemo(() => {
    let count = 0;
    for (const day of calendarWeek) {
      if (!day.isFuture && trainedDaysMap.has(day.date)) {
        count++;
      }
    }
    return count;
  }, [calendarWeek, trainedDaysMap]);

  const streakLabel =
    score?.currentStreak && score.currentStreak > 0
      ? `${score.currentStreak} day streak`
      : 'No active streak';

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          padding: inset.md,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLabel}>
          <View style={[styles.headerDot, { backgroundColor: colors.accent.default }]} />
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.primary }]}>
            Discipline
          </Text>
        </View>
        <View style={[styles.weekBadge, { backgroundColor: colors.surface.secondary }]}>
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
            {weeklySessionsCount} this week
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBlock}>
          <View style={styles.scoreLine}>
            <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
              {score?.score !== undefined ? score.score : '—'}
            </Text>
            {score?.score !== undefined ? (
              <Text style={[typography.textPresets.callout, { color: colors.text.tertiary }]}>
                /100
              </Text>
            ) : null}
          </View>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            {streakLabel}
          </Text>
        </View>

        <View style={styles.monthlyBlock}>
          <AnimatedProgressRing
            size={72}
            strokeWidth={4}
            percent={goalPercent}
            trackColor={colors.border.subtle}
            progressColor={colors.accent.default}
          >
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.primary }]}>
              {currentMonthCount}
            </Text>
            <Text style={[typography.textPresets.label, { color: colors.text.tertiary }]}>
              /{monthlyGoal}
            </Text>
          </AnimatedProgressRing>
          <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
            30-day sessions
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

      <RevealOnMount delay={100}>
        <View style={[styles.weekStrip, { gap: gap.xs }]}>
          {calendarWeek.map((day) => {
            let state: DayState = 'missed';
            if (day.isFuture) {
              state = 'future';
            } else if (trainedDaysMap.has(day.date)) {
              state = 'trained';
            } else if (day.isToday) {
              state = 'today';
            }

            return <DisciplineDayPip key={day.date} label={day.label} state={state} />;
          })}
        </View>
      </RevealOnMount>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  headerDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  weekBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreBlock: {
    flex: 1,
    gap: 6,
  },
  scoreLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 2,
  },
  monthlyBlock: {
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 16,
    marginTop: 20,
  },
  weekStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  dayDot: {
    alignItems: 'center',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  todayCore: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
});
