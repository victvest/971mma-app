import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { ProgressBar, SectionHeader } from '../components/primitives';
import { trainingSessions, trainingStats } from '../data/memberFeatures';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function TrainingScreen() {
  const navigation = useNavigation<Nav>();
  const pct = Math.round((trainingStats.sessionsThisMonth / trainingStats.monthlyGoal) * 100);

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Training log" subtitle="Sessions & attendance" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroStats}>
          <GlassSurface style={styles.heroTile} padding={spacing.lg}>
            <Text style={styles.heroValue}>{trainingStats.sessionsThisMonth}</Text>
            <Text style={styles.heroLabel}>Sessions this month</Text>
            <ProgressBar percent={pct} height={6} />
            <Text style={styles.heroHint}>{trainingStats.monthlyGoal - trainingStats.sessionsThisMonth} to goal</Text>
          </GlassSurface>
          <View style={styles.heroCol}>
            <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
              <Text style={styles.miniValue}>{trainingStats.streakDays}d</Text>
              <Text style={styles.miniLabel}>Streak</Text>
            </GlassSurface>
            <GlassSurface padding={spacing.lg} style={{ flex: 1, marginTop: spacing.sm }}>
              <Text style={styles.miniValue}>{trainingStats.hoursThisMonth}h</Text>
              <Text style={styles.miniLabel}>On the mat</Text>
            </GlassSurface>
          </View>
        </View>

        <View style={styles.rowCards}>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <Ionicons name="flame-outline" size={20} color={palette.red} />
            <Text style={styles.cardValue}>{trainingStats.disciplineScore}</Text>
            <Text style={styles.cardLabel}>Discipline score</Text>
          </GlassSurface>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text style={styles.cardValue}>{trainingStats.lastCheckIn}</Text>
            <Text style={styles.cardLabel}>Last check-in</Text>
          </GlassSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent sessions" />
          <View style={{ gap: spacing.sm }}>
            {trainingSessions.map((s) => (
              <GlassSurface key={s.id} padding={spacing.lg}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <Ionicons name="fitness-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>{s.className}</Text>
                    <Text style={styles.sessionMeta}>{s.date} · {s.coach} · {s.durationMin} min</Text>
                  </View>
                  <View style={styles.pointsPill}>
                    <Text style={styles.pointsText}>+{s.pointsEarned}</Text>
                  </View>
                </View>
              </GlassSurface>
            ))}
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Rewards')}>
          <Text style={styles.linkText}>View rewards from sessions</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 132 },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  heroTile: { flex: 1.4 },
  heroCol: { flex: 1 },
  heroValue: { fontFamily: fonts.displayBlack, fontSize: 36, color: colors.text },
  heroLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  heroHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: spacing.sm },
  miniValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  miniLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowCards: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cardValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.sm },
  cardLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  section: { marginTop: spacing.xxl },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  sessionMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pointsPill: {
    backgroundColor: palette.goldGlass,
    borderWidth: 1,
    borderColor: 'rgba(168,132,47,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pointsText: { fontFamily: fonts.bold, fontSize: 12, color: palette.goldDeep },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },
  linkText: { fontFamily: fonts.semi, fontSize: 14, color: colors.accent },
});
