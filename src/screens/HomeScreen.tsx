import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radii, shadow, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import { ClassCard } from '../components/ClassCard';
import { Tag, SectionHeader, ProgressBar, Label } from '../components/primitives';
import {
  membership,
  progress,
  announcement,
  recentActivity,
  heroImage,
} from '../data/mockData';
import { useClasses } from '../hooks/useClasses';
import { useProfile } from '../hooks/useProfile';

function firstName(email?: string | null, full?: string) {
  if (full) return full.split(' ')[0];
  if (!email) return 'Athlete';
  const handle = email.split('@')[0];
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  expired: 'Expired',
};

export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { classes, book, cancel, busyId } = useClasses();
  const { profile } = useProfile();

  const name = firstName(user?.email, profile?.fullName || (user?.user_metadata as any)?.full_name);
  const checkInPct = Math.round((membership.checkInsThisMonth / membership.monthlyGoal) * 100);

  const statusLabel = STATUS_LABEL[profile?.membershipStatus ?? 'active'] ?? 'Active';
  const statusTone = profile?.membershipStatus === 'expired' ? 'red' : 'green';

  const nextUp = classes[0];
  const todayList = classes.filter((c) => c.day === 'Today').slice(0, 3);
  const upcomingList = todayList.length ? todayList : classes.slice(0, 3);

  const beltRank = profile?.beltRank ?? progress.rank;
  const beltStripes = profile?.beltStripes ?? progress.stripes;
  const nextRank = `${beltRank} · Stripe ${beltStripes + 1}`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader title="971 MMA" subtitle="Member command" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Welcome back,</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Tag label={statusLabel} tone={statusTone} solid />
        </View>

        {/* Hero next-up card */}
        <View style={styles.hero}>
          <Image source={heroImage} style={StyleSheet.absoluteFill as any} />
          <LinearGradient
            colors={['rgba(11,11,12,0.15)', 'rgba(11,11,12,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>NEXT UP · {(nextUp?.day ?? 'TODAY').toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle}>{nextUp?.title ?? 'BJJ Fundamentals'}</Text>
            <Text style={styles.heroMeta}>
              {nextUp ? `${nextUp.startTime} · ${nextUp.coach}` : '18:00 · Coach Tony'}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => navigation.navigate('Scan')}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code-outline" size={16} color="#fff" />
                <Text style={styles.heroBtnText}>Check in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroBtnGhost}
                onPress={() => navigation.navigate('Classes')}
                activeOpacity={0.85}
              >
                <Text style={styles.heroBtnGhostText}>View schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{membership.checkInsThisMonth}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
            <Text style={styles.statSub}>this month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{membership.streakDays}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
            <Text style={styles.statSub}>on fire</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>86</Text>
            <Text style={styles.statLabel}>Discipline</Text>
            <Text style={styles.statSub}>score</Text>
          </View>
        </View>

        {/* Monthly goal */}
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.goalHeader}>
            <View>
              <Label>Monthly goal</Label>
              <Text style={styles.goalTitle}>
                {membership.checkInsThisMonth} of {membership.monthlyGoal} sessions
              </Text>
            </View>
            <Text style={styles.goalPct}>{checkInPct}%</Text>
          </View>
          <ProgressBar percent={checkInPct} />
          <Text style={styles.goalHint}>
            {membership.monthlyGoal - membership.checkInsThisMonth} more to hit your target. Keep showing up.
          </Text>
        </Card>

        {/* Today's classes */}
        <View style={styles.section}>
          <SectionHeader
            title="Today at 971"
            action="See all"
            onAction={() => navigation.navigate('Classes')}
          />
          <View style={{ gap: spacing.md }}>
            {upcomingList.map((c) => (
              <ClassCard
                key={c.id}
                item={c}
                busy={busyId === c.id}
                onBook={() => book(c.id)}
                onCancel={() => cancel(c.id)}
              />
            ))}
          </View>
        </View>

        {/* Belt progress */}
        <View style={styles.section}>
          <SectionHeader title="Your progress" action="Details" onAction={() => navigation.navigate('Profile')} />
          <Card>
            <View style={styles.progressHead}>
              <View style={styles.beltBadge}>
                <Ionicons name="ribbon-outline" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressRank}>{beltRank} · {beltStripes} stripes</Text>
                <Text style={styles.progressTrack}>{progress.track}</Text>
              </View>
              <Text style={styles.progressPct}>{progress.percent}%</Text>
            </View>
            <ProgressBar percent={progress.percent} />
            <Text style={styles.nextRank}>Next: {nextRank}</Text>
          </Card>
        </View>

        {/* Announcement */}
        <View style={styles.section}>
          <Card style={styles.announce}>
            <Tag label={announcement.tag} tone="red" />
            <Text style={styles.announceTitle}>{announcement.title}</Text>
            <Text style={styles.announceText}>{announcement.detail}</Text>
          </Card>
        </View>

        {/* Recent activity */}
        <View style={styles.section}>
          <SectionHeader title="Recent activity" />
          <Card padded={false}>
            {recentActivity.map((a, i) => (
              <View
                key={a.id}
                style={[styles.activityRow, i < recentActivity.length - 1 && styles.activityBorder]}
              >
                <View
                  style={[
                    styles.activityDot,
                    {
                      backgroundColor:
                        a.accent === 'red'
                          ? colors.danger
                          : a.accent === 'ink'
                          ? colors.text
                          : colors.accent,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{a.title}</Text>
                  <Text style={styles.activityDetail}>{a.detail}</Text>
                </View>
                <Text style={styles.activityTime}>{a.time}</Text>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 120 },

  greetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { ...typography.body, color: colors.textMuted },
  name: { ...typography.h1, color: colors.text, marginTop: 2 },

  hero: {
    height: 230,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', padding: spacing.lg },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  liveText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  heroBottom: { padding: spacing.xl },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 13.5, fontWeight: '600', marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    height: 42,
    borderRadius: radii.md,
  },
  heroBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  heroBtnGhost: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroBtnGhostText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadow.soft,
  },
  statValue: { ...typography.stat, color: colors.accent },
  statLabel: { fontSize: 12.5, fontWeight: '800', color: colors.text, marginTop: 6 },
  statSub: { fontSize: 11, color: colors.textFaint, fontWeight: '600', marginTop: 1 },

  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  goalTitle: { ...typography.h3, color: colors.text, marginTop: 4 },
  goalPct: { ...typography.h2, color: colors.accent },
  goalHint: { marginTop: spacing.md, fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  section: { marginTop: spacing.xxl },

  progressHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  beltBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRank: { ...typography.h3, color: colors.text },
  progressTrack: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  progressPct: { ...typography.h2, color: colors.accent },
  nextRank: { marginTop: spacing.md, fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  announce: { backgroundColor: colors.text, borderColor: colors.text },
  announceTitle: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: spacing.md },
  announceText: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5, lineHeight: 20, marginTop: 6 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  activityTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  activityDetail: { fontSize: 12.5, color: colors.textMuted, fontWeight: '500', marginTop: 1 },
  activityTime: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
});
