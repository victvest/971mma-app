import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, glow, palette, radii, shadow, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { AuroraBackground } from '../components/AuroraBackground';
import { GlassSurface } from '../components/GlassSurface';
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
      <AuroraBackground tone="green" />
      <AppHeader title="971 MMA" subtitle="Member command" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Welcome back,</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Tag label={statusLabel} tone={statusTone} solid />
        </View>

        {/* Hero next-up card */}
        <View style={[styles.hero, glow.green]}>
          <Image source={heroImage} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(4,6,10,0.1)', 'rgba(4,6,10,0.6)', 'rgba(4,6,10,0.94)']}
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
              <Pressable
                style={styles.heroBtn}
                onPress={() => navigation.navigate('Scan')}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[palette.greenBright, palette.green]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroBtnFill}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#04150C" />
                  <Text style={styles.heroBtnText}>Check in</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.heroBtnGhost}
                onPress={() => navigation.navigate('Classes')}
                accessibilityRole="button"
              >
                <Text style={styles.heroBtnGhostText}>View schedule</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          <StatTile value={String(membership.checkInsThisMonth)} label="Check-ins" sub="this month" tone="green" />
          <StatTile value={String(membership.streakDays)} label="Day streak" sub="on fire" tone="red" />
          <StatTile value="86" label="Discipline" sub="score" tone="gold" />
        </View>

        {/* Monthly goal */}
        <GlassSurface style={{ marginTop: spacing.lg }}>
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
        </GlassSurface>

        {/* Today's classes */}
        <View style={styles.section}>
          <SectionHeader title="Today at 971" action="See all" onAction={() => navigation.navigate('Classes')} />
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
          <GlassSurface tone="green">
            <View style={styles.progressHead}>
              <View style={styles.beltBadge}>
                <Ionicons name="ribbon-outline" size={22} color={colors.accentBright} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressRank}>{beltRank} · {beltStripes} stripes</Text>
                <Text style={styles.progressTrack}>{progress.track}</Text>
              </View>
              <Text style={styles.progressPct}>{progress.percent}%</Text>
            </View>
            <ProgressBar percent={progress.percent} />
            <Text style={styles.nextRank}>Next: {nextRank}</Text>
          </GlassSurface>
        </View>

        {/* Announcement */}
        <View style={styles.section}>
          <GlassSurface tone="gold" style={styles.announce}>
            <Tag label={announcement.tag} tone="gold" />
            <Text style={styles.announceTitle}>{announcement.title}</Text>
            <Text style={styles.announceText}>{announcement.detail}</Text>
          </GlassSurface>
        </View>

        {/* Recent activity */}
        <View style={styles.section}>
          <SectionHeader title="Recent activity" />
          <GlassSurface padding={false}>
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
                          ? colors.gold
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
          </GlassSurface>
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({
  value,
  label,
  sub,
  tone,
}: {
  value: string;
  label: string;
  sub: string;
  tone: 'green' | 'red' | 'gold';
}) {
  const color = tone === 'red' ? palette.redBright : tone === 'gold' ? colors.gold : colors.accentBright;
  return (
    <GlassSurface style={styles.statCard} padding={spacing.lg}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 132 },

  greetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  name: { ...typography.h1, color: colors.text, marginTop: 2 },

  hero: {
    height: 236,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.greenLine,
  },
  heroTop: { flexDirection: 'row', padding: spacing.lg },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(4,6,10,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  liveText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1 },
  heroBottom: { padding: spacing.xl },
  heroTitle: { color: '#fff', fontFamily: fonts.displayBlack, fontSize: 32, letterSpacing: 0.4 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 13.5, marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  heroBtn: { borderRadius: radii.md, overflow: 'hidden' },
  heroBtnFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  heroBtnText: { color: '#04150C', fontFamily: fonts.bold, fontSize: 14 },
  heroBtnGhost: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroBtnGhostText: { color: '#fff', fontFamily: fonts.semi, fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1 },
  statValue: { fontFamily: fonts.displayBlack, fontSize: 30, letterSpacing: 0.3 },
  statLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, marginTop: 6 },
  statSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, marginTop: 1 },

  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  goalTitle: { ...typography.h3, color: colors.text, marginTop: 4 },
  goalPct: { fontFamily: fonts.displayBlack, fontSize: 24, color: colors.accentBright },
  goalHint: { marginTop: spacing.md, fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  section: { marginTop: spacing.xxl },

  progressHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  beltBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRank: { ...typography.h3, color: colors.text },
  progressTrack: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  progressPct: { fontFamily: fonts.displayBlack, fontSize: 22, color: colors.accentBright },
  nextRank: { marginTop: spacing.md, fontFamily: fonts.semi, fontSize: 13, color: colors.textMuted },

  announce: {},
  announceTitle: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, marginTop: spacing.md, letterSpacing: 0.2 },
  announceText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, marginTop: 6 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  activityTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  activityDetail: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  activityTime: { fontFamily: fonts.semi, fontSize: 12, color: colors.textFaint },
});
