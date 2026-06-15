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
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, spacing, typography, brand } from '../theme';
import { useAuth } from '../context/AuthContext';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { ClassCard } from '../components/ClassCard';
import { AppIcon, type AppIconName } from '../components/icons/FeatureIcon';
import { KnowYourHistory } from '../components/KnowYourHistory';
import { Tag, SectionHeader, ProgressBar } from '../components/primitives';
import { membership, announcement, heroImage } from '../data/mockData';
import { rewardsProfile } from '../data/memberFeatures';
import { useClasses } from '../hooks/useClasses';
import { useProfile } from '../hooks/useProfile';
import type { MainStackParamList, TabsParamList } from '../navigation/types';

function firstName(email?: string | null, full?: string) {
  if (full) return full.split(' ')[0];
  if (!email) return 'Athlete';
  const handle = email.split('@')[0];
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

export function HomeScreen() {
  const { user } = useAuth();
  const tabNav = useNavigation<BottomTabNavigationProp<TabsParamList, 'Home'>>();
  const stackNav = tabNav.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const { classes } = useClasses();
  const { profile } = useProfile();

  const name = firstName(user?.email, profile?.fullName || (user?.user_metadata as any)?.full_name);
  const checkInPct = Math.round((membership.checkInsThisMonth / membership.monthlyGoal) * 100);
  const nextUp = classes.find((c) => c.day === 'Today') ?? classes[0];
  const todayList = classes.filter((c) => c.day === 'Today').slice(0, 4);

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="971 MMA" subtitle="Earn Your Level" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Good to see you,</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Tag label={membership.plan} tone="green" />
        </View>

        <View style={styles.featureGrid}>
          <FeatureTile
            icon="training"
            tone="green"
            label="Training"
            value={`${membership.checkInsThisMonth} sessions`}
            onPress={() => stackNav?.navigate('Training')}
          />
          <FeatureTile
            icon="rewards"
            tone="gold"
            label="Rewards"
            value={`${rewardsProfile.points} pts`}
            onPress={() => stackNav?.navigate('Rewards')}
          />
          <FeatureTile
            icon="belt"
            tone="red"
            label="Belt"
            value="68% next stripe"
            onPress={() => stackNav?.navigate('BeltJourney')}
          />
        </View>

        {/* Primary action — walk in, show pass, train */}
        <Pressable
          onPress={() => tabNav.navigate('Scan')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.checkInBtn, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[...brand.cta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkInFill}
          >
            <View style={styles.checkInIcon}>
              <Ionicons name="qr-code" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkInTitle}>Check in at the gym</Text>
              <Text style={styles.checkInSub}>Open your member pass — no booking needed</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        </Pressable>

        {/* Next session */}
        {nextUp ? (
          <GlassSurface strong tone="green" style={{ marginTop: spacing.lg }}>
            <View style={styles.nextRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLabel}>Up next today</Text>
                <Text style={styles.nextTitle}>{nextUp.title}</Text>
                <Text style={styles.nextMeta}>
                  {nextUp.startTime} · {nextUp.coach} · {nextUp.durationMin} min
                </Text>
              </View>
              <Image source={nextUp.image ?? heroImage} style={styles.nextThumb} />
            </View>
          </GlassSurface>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatTile value={String(membership.checkInsThisMonth)} label="Check-ins" sub="this month" />
          <StatTile value={String(membership.streakDays)} label="Day streak" sub="keep going" accent="red" />
        </View>

        <GlassSurface style={{ marginTop: spacing.lg }}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>Monthly goal</Text>
            <Text style={styles.goalPct}>{checkInPct}%</Text>
          </View>
          <ProgressBar percent={checkInPct} />
          <Text style={styles.goalHint}>
            {membership.checkInsThisMonth} of {membership.monthlyGoal} sessions
          </Text>
        </GlassSurface>

        {/* Know Your History — v3 signature block */}
        <View style={styles.section}>
          <KnowYourHistory
            memberName={name}
            beltRank={profile?.beltRank ?? undefined}
            beltStripes={profile?.beltStripes}
            onTrainingLog={() => stackNav?.navigate('Training')}
            onBeltJourney={() => stackNav?.navigate('BeltJourney')}
          />
        </View>

        {/* Today's schedule — browse only */}
        <View style={styles.section}>
          <SectionHeader title="Today's schedule" action="Full week" onAction={() => tabNav.navigate('Classes')} />
          <View style={{ gap: spacing.sm }}>
            {todayList.length ? (
              todayList.map((c) => <ClassCard key={c.id} item={c} compact />)
            ) : (
              <GlassSurface>
                <Text style={styles.emptySchedule}>No classes listed for today.</Text>
              </GlassSurface>
            )}
          </View>
        </View>

        {/* Gym news */}
        <View style={styles.section}>
          <GlassSurface tone="gold">
            <Tag label={announcement.tag} tone="gold" />
            <Text style={styles.announceTitle}>{announcement.title}</Text>
            <Text style={styles.announceText}>{announcement.detail}</Text>
          </GlassSurface>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function FeatureTile({
  icon,
  tone,
  label,
  value,
  onPress,
}: {
  icon: AppIconName;
  tone: 'green' | 'gold' | 'red' | 'ink' | 'neutral';
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.featureTileWrap, pressed && { opacity: 0.92 }]}>
      <GlassSurface padding={spacing.md} style={styles.featureTile}>
        <AppIcon name={icon} size={40} tone={tone} />
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureValue} numberOfLines={1}>{value}</Text>
      </GlassSurface>
    </Pressable>
  );
}

function StatTile({
  value,
  label,
  sub,
  accent,
}: {
  value: string;
  label: string;
  sub: string;
  accent?: 'red';
}) {
  const color = accent === 'red' ? palette.red : colors.accent;
  return (
    <GlassSurface style={styles.statCard} padding={spacing.lg}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 132 },

  greetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  name: { ...typography.h1, color: colors.text, marginTop: 2 },

  featureGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  featureTileWrap: { flex: 1 },
  featureTile: { minHeight: 88 },
  featureLabel: { fontFamily: fonts.semi, fontSize: 12, color: colors.text, marginTop: spacing.sm },
  featureValue: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  checkInBtn: { borderRadius: radii.xl, overflow: 'hidden' },
  checkInFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  checkInIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff', letterSpacing: -0.2 },
  checkInSub: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 3 },

  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  nextTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  nextMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  nextThumb: { width: 64, height: 64, borderRadius: 16 },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1 },
  statValue: { fontFamily: fonts.displayBlack, fontSize: 28, letterSpacing: 0.2 },
  statLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.text, marginTop: 4 },
  statSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: 1 },

  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  goalTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  goalPct: { fontFamily: fonts.displayBold, fontSize: 22, color: palette.red },
  goalHint: { marginTop: spacing.md, fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  section: { marginTop: spacing.xxl },
  emptySchedule: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  announceTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: spacing.md, letterSpacing: -0.2 },
  announceText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, lineHeight: 21, marginTop: 6 },
});
