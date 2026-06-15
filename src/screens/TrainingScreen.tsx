import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { SessionTimeline } from '../components/tracking/SessionTimeline';
import { AppIcon } from '../components/icons/FeatureIcon';
import { trainingSessions, trainingStats } from '../data/memberFeatures';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function TrainingScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Training log" subtitle="Earn Your Level · every session counts" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.rings}>
          <StatRing
            value={trainingStats.sessionsThisMonth}
            max={trainingStats.monthlyGoal}
            label="Sessions"
            sub="this month"
            tone="green"
          />
          <StatRing value={trainingStats.streakDays} max={30} label="Streak" sub="days" tone="red" />
          <StatRing
            value={Math.round(trainingStats.hoursThisMonth)}
            max={24}
            label="Hours"
            sub="on mat"
            tone="gold"
          />
        </View>

        <View style={styles.insightRow}>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <AppIcon name="flame" size={40} tone="red" />
            <Text style={styles.insightVal}>{trainingStats.disciplineScore}</Text>
            <Text style={styles.insightLbl}>Discipline score</Text>
          </GlassSurface>
          <GlassSurface padding={spacing.lg} style={{ flex: 1 }}>
            <AppIcon name="time" size={40} tone="green" />
            <Text style={styles.insightVal}>{trainingStats.lastCheckIn}</Text>
            <Text style={styles.insightLbl}>Last check-in</Text>
          </GlassSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Session timeline" />
          <SessionTimeline sessions={trainingSessions} />
        </View>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Rewards')}>
          <Text style={styles.linkText}>Convert sessions to rewards</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
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
  section: { marginTop: spacing.xxl },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },
  linkText: { fontFamily: fonts.semi, fontSize: 14, color: colors.accent },
});
