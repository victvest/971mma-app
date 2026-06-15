import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, palette, radii, shadow, spacing } from '../../theme';
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

function barStyle(status: WeekDayStatus) {
  if (status === 'accent') return styles.barAccent;
  if (status === 'done') return styles.barDone;
  return styles.barPending;
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
    <View style={[styles.card, shadow.soft]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{disciplineScore}</Text>
            <Text style={styles.scoreOf}>/100</Text>
          </View>
          <Text style={styles.scoreLbl}>Discipline score</Text>
          <View style={styles.streak}>
            <Ionicons name="flame" size={16} color={palette.red} />
            <Text style={styles.streakText}>{streakDays}-day streak</Text>
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
            <Text style={styles.ringVal}>{sessionsThisMonth}</Text>
            <Text style={styles.ringSub}>OF {monthlyGoal} · JUNE</Text>
          </View>
        </View>
      </View>

      <View style={styles.week}>
        <View style={styles.weekHead}>
          <Text style={styles.weekLbl}>THIS WEEK</Text>
          <Text style={styles.weekCount}>{weekCount} sessions</Text>
        </View>
        <View style={styles.bars}>
          {weekDays.map((status, i) => (
            <View key={`${LABELS[i]}-${i}`} style={styles.barCol}>
              <View style={[styles.bar, barStyle(status)]} />
              <Text style={styles.barLbl}>{LABELS[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  score: { fontFamily: fonts.displayBlack, fontSize: 36, color: colors.text, lineHeight: 38 },
  scoreOf: { fontFamily: fonts.semi, fontSize: 16, color: colors.textMuted, marginBottom: 4 },
  scoreLbl: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
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
  barAccent: { backgroundColor: palette.green },
  barDone: { backgroundColor: palette.black },
  barPending: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.insetStrong },
  barLbl: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint },
});
