import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing, ProgressRingCenter } from '../components/ProgressRing';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, shadow, spacing } from '../theme';
import { AcademyHeader } from '../components/AcademyHeader';
import { ScreenShell } from '../components/ScreenShell';
import { eightWeekActivity, membership, totalSessionsLogged } from '../data/mockData';
import { beltJourney, type BeltRequirement } from '../data/memberFeatures';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import type { MainStackParamList } from '../navigation/types';

function firstName(email?: string | null, full?: string) {
  if (full) return full.split(' ')[0];
  if (!email) return 'Athlete';
  return email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function BeltJourneyScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const nav = useNavigation();
  const stackNav = nav.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const name = firstName(user?.email, profile?.fullName || (user?.user_metadata as any)?.full_name);
  const remaining = membership.monthlyGoal - membership.checkInsThisMonth;

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <AcademyHeader memberName={name} initials={initials(name)} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.goalCard, shadow.soft]}>
          <View style={styles.goalRow}>
            <GoalRing value={membership.checkInsThisMonth} max={membership.monthlyGoal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.goalLbl}>JUNE GOAL</Text>
              <Text style={styles.goalTitle}>{remaining} sessions to go</Text>
              <View style={styles.stats}>
                <StatCol value={String(membership.streakDays)} label="STREAK" />
                <StatCol value={String(totalSessionsLogged)} label="TOTAL" accent />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.weekCard, shadow.soft]}>
          <View style={styles.weekHead}>
            <Text style={styles.weekLbl}>LAST 8 WEEKS</Text>
            <View style={styles.consistent}>
              <Ionicons name="checkmark-circle" size={14} color={palette.green} />
              <Text style={styles.consistentText}>CONSISTENT</Text>
            </View>
          </View>
          <View style={styles.bars}>
            {eightWeekActivity.map((h, i) => (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.bar, { height: 24 + h * 48 }, i === 7 && styles.barCurrent]} />
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Requirements</Text>
        <View style={styles.reqList}>
          {beltJourney.requirements.map((r) => (
            <RequirementRow key={r.id} item={r} />
          ))}
        </View>

        <Pressable
          onPress={() => stackNav?.navigate('Rewards')}
          style={[styles.rewardBtn, shadow.soft]}
          accessibilityRole="button"
        >
          <Ionicons name="gift-outline" size={18} color={colors.text} />
          <Text style={styles.rewardText}>See reward path</Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function GoalRing({ value, max }: { value: number; max: number }) {
  const size = 96;
  return (
    <View style={styles.ringWrap}>
      <ProgressRing size={size} stroke={9} value={value} max={max} />
      <ProgressRingCenter size={size}>
        <Text style={styles.ringVal}>{value}</Text>
        <Text style={styles.ringSub}>OF {max}</Text>
      </ProgressRingCenter>
    </View>
  );
}

function StatCol({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statVal, accent && { color: palette.green }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function RequirementRow({ item }: { item: BeltRequirement }) {
  const done = item.state === 'done';
  const active = item.state === 'active';
  const locked = item.state === 'locked';

  return (
    <View style={[styles.reqCard, shadow.soft, locked && styles.reqLocked]}>
      <Ionicons
        name={done ? 'checkmark-circle' : locked ? 'lock-closed' : 'water'}
        size={22}
        color={done ? palette.green : locked ? colors.textFaint : palette.green}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.reqTitle, locked && styles.reqTitleLocked]}>{item.label}</Text>
        <Text style={[styles.reqDetail, done && { color: palette.green }]}>{item.detail}</Text>
      </View>
      {done ? <Ionicons name="checkmark" size={18} color={palette.green} /> : null}
      {active ? (
        <View style={styles.nowPill}>
          <Text style={styles.nowText}>NOW</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  goalRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  ringWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringVal: { fontFamily: fonts.displayBlack, fontSize: 28, color: colors.text },
  ringSub: { fontFamily: fonts.bold, fontSize: 9, color: colors.textFaint, letterSpacing: 0.6 },
  goalLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8 },
  goalTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 6 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  statCol: {},
  statVal: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  statLbl: { fontFamily: fonts.bold, fontSize: 10, color: colors.textFaint, letterSpacing: 0.6, marginTop: 2 },
  weekCard: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  weekLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8 },
  consistent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: palette.greenLine,
    backgroundColor: palette.greenGlass,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  consistentText: { fontFamily: fonts.bold, fontSize: 10, color: palette.green, letterSpacing: 0.5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 72 },
  barWrap: { flex: 1, justifyContent: 'flex-end' },
  bar: { backgroundColor: palette.insetStrong, borderRadius: 6 },
  barCurrent: { backgroundColor: palette.green },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md },
  reqList: { gap: spacing.sm },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.lg,
  },
  reqLocked: { opacity: 0.55 },
  reqTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  reqTitleLocked: { color: colors.textMuted },
  reqDetail: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  nowPill: { backgroundColor: palette.green, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  nowText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.6 },
  rewardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    paddingVertical: spacing.lg,
    marginTop: spacing.xxl,
  },
  rewardText: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
});
