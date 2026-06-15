import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { GlassCard } from '../../ui';
import { colors, fonts, palette, spacing } from '../../theme';
import type { WeekDayStatus } from '../../data/mockData';

type Props = {
  disciplineScore: number;
  streakDays: number;
  sessionsThisMonth: number;
  monthlyGoal: number;
  weekCount: number;
  weekDays: readonly WeekDayStatus[];
};

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function barProps(status: WeekDayStatus) {
  if (status === 'accent') return { backgroundColor: palette.green };
  if (status === 'done') return { backgroundColor: palette.black };
  return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.insetStrong };
}

export function PerformanceStrip({
  disciplineScore,
  streakDays,
  sessionsThisMonth,
  monthlyGoal,
  weekCount,
  weekDays,
}: Props) {
  const pct = sessionsThisMonth / monthlyGoal;
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct));

  return (
    <GlassCard style={styles.card}>
      <View style={styles.pad}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <View style={styles.scoreRow}>
              <PaperText style={styles.score}>{disciplineScore}</PaperText>
              <PaperText style={styles.scoreOf}>/100</PaperText>
            </View>
            <PaperText style={styles.scoreLbl}>Discipline score</PaperText>
            <View style={styles.streak}>
              <PaperText style={styles.streakText}>🔥 {streakDays}-day streak</PaperText>
            </View>
          </View>
          <View style={styles.ringWrap}>
            <Svg width={size} height={size}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.insetStrong} strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={palette.green}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={offset}
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <PaperText style={styles.ringVal}>{sessionsThisMonth}</PaperText>
              <PaperText style={styles.ringSub}>OF {monthlyGoal} · JUNE</PaperText>
            </View>
          </View>
        </View>

        <View style={styles.week}>
          <View style={styles.weekHead}>
            <PaperText style={styles.weekLbl}>THIS WEEK</PaperText>
            <PaperText style={styles.weekCount}>{weekCount} sessions</PaperText>
          </View>
          <View style={styles.bars}>
            {weekDays.map((status, i) => (
              <View key={`${LABELS[i]}-${i}`} style={styles.barCol}>
                <View style={[styles.bar, barProps(status)]} />
                <PaperText style={styles.barLbl}>{LABELS[i]}</PaperText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  pad: { padding: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  score: { fontFamily: fonts.displayBlack, fontSize: 36, color: colors.text, lineHeight: 38 },
  scoreOf: { fontFamily: fonts.semi, fontSize: 16, color: colors.textMuted, marginBottom: 4 },
  scoreLbl: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  streak: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  streakText: { fontFamily: fonts.semi, fontSize: 13, color: palette.red },
  ringWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringVal: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  ringSub: { fontFamily: fonts.bold, fontSize: 7, color: colors.textFaint, letterSpacing: 0.4, textAlign: 'center' },
  week: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.hairline },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  weekLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8 },
  weekCount: { fontFamily: fonts.semi, fontSize: 13, color: colors.text },
  bars: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: '100%', height: 36, borderRadius: 8 },
  barLbl: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint },
});
