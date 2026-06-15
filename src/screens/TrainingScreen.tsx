import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, spacing } from '../theme';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { SectionHeader } from '../components/primitives';
import { StatRing } from '../components/tracking/StatRing';
import { SessionHistory } from '../components/tracking/SessionHistory';
import { AppIcon } from '../components/icons/FeatureIcon';
import { useTrainingHistory } from '../hooks/useTrainingHistory';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function TrainingScreen() {
  const navigation = useNavigation<Nav>();
  const { sessions, stats, refreshing, refresh, source } = useTrainingHistory();

  const totalPoints = useMemo(
    () => sessions.slice(0, 20).reduce((sum, s) => sum + s.pointsEarned, 0),
    [sessions],
  );

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Training log" subtitle="Know Your History · every session counts" showBell={false} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.rings}>
          <StatRing
            value={stats.sessionsThisMonth}
            max={stats.monthlyGoal}
            label="Sessions"
            sub="this month"
            tone="green"
          />
          <StatRing value={stats.streakDays} max={30} label="Streak" sub="days" tone="red" />
          <StatRing
            value={Math.round(stats.hoursThisMonth)}
            max={24}
            label="Hours"
            sub="on mat"
            tone="gold"
          />
        </View>

        <View style={styles.insightRow}>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <AppIcon name="flame" size={40} tone="red" />
            <Text style={styles.insightVal}>{stats.disciplineScore}</Text>
            <Text style={styles.insightLbl}>Discipline score</Text>
          </GlassSurface>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <AppIcon name="time" size={40} tone="green" />
            <Text style={styles.insightVal}>{stats.lastCheckIn}</Text>
            <Text style={styles.insightLbl}>Last check-in</Text>
          </GlassSurface>
        </View>

        <GlassSurface style={styles.summaryCard} padding={spacing.lg}>
          <Text style={styles.summaryTitle}>History snapshot</Text>
          <Text style={styles.summaryText}>
            {sessions.length} logged sessions · {totalPoints} pts earned in recent history
            {source === 'mock' ? ' · demo data' : ''}
          </Text>
        </GlassSurface>

        <View style={styles.section}>
          <SectionHeader title="Session history" />
          <SessionHistory sessions={sessions} />
        </View>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Rewards')}>
          <Text style={styles.linkText}>Convert sessions to rewards</Text>
          <Ionicons name="arrow-forward" size={16} color={palette.red} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 132 },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  insightRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  insightVal: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginTop: spacing.sm },
  insightLbl: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  summaryCard: { marginTop: spacing.lg },
  summaryTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.text },
  summaryText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  section: { marginTop: spacing.xxl },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },
  linkText: { fontFamily: fonts.semi, fontSize: 14, color: palette.red },
});
