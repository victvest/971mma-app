import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { AcademyHeader } from '../components/AcademyHeader';
import { ScreenShell } from '../components/ScreenShell';
import { LiveClassCard } from '../components/home/LiveClassCard';
import { PerformanceStrip } from '../components/home/PerformanceStrip';
import { QuickPassRow } from '../components/home/QuickPassRow';
import { BeltPathCard } from '../components/home/BeltPathCard';
import { LineageHistoryCard } from '../components/home/LineageHistoryCard';
import { CoachesPreview } from '../components/home/CoachesPreview';
import { useAuth } from '../context/AuthContext';
import {
  coachProfiles,
  disciplineScore,
  lineage,
  membership,
  weekActivity,
} from '../data/mockData';
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function HomeScreen() {
  const { user } = useAuth();
  const tabNav = useNavigation<BottomTabNavigationProp<TabsParamList, 'Home'>>();
  const stackNav = tabNav.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const { classes } = useClasses();
  const { profile } = useProfile();

  const name = firstName(user?.email, profile?.fullName || (user?.user_metadata as any)?.full_name);
  const nextUp = classes.find((c) => c.day === 'Today') ?? classes[0];
  const rank = profile?.beltRank ?? 'White Belt';
  const stripes = profile?.beltStripes ?? 2;
  const sessionsToStripe = Math.max(0, 3 - (membership.checkInsThisMonth % 4));

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <AcademyHeader memberName={name} initials={initials(name)} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>
          Earn Your <Text style={styles.heroAccent}>Level.</Text>
        </Text>
        <Text style={styles.heroSub}>Scan in. Show up. Let your progress prove itself.</Text>

        {nextUp ? (
          <LiveClassCard
            image={nextUp.image}
            discipline={`${nextUp.discipline} GI`}
            time={nextUp.startTime}
            title={nextUp.title.replace('BJJ ', '').replace('Muay Thai ', '')}
            focus="Closed guard retention"
            coach={nextUp.coach}
            spotsLeft={Math.max(1, nextUp.capacity - nextUp.booked)}
            onCheckIn={() => tabNav.navigate('Scan')}
          />
        ) : null}

        <PerformanceStrip
          disciplineScore={disciplineScore}
          streakDays={membership.streakDays}
          sessionsThisMonth={membership.checkInsThisMonth}
          monthlyGoal={membership.monthlyGoal}
          weekCount={weekActivity.sessionCount}
          weekDays={weekActivity.days}
        />

        <QuickPassRow
          points={rewardsProfile.points}
          pointsToNext={rewardsProfile.pointsToNext}
          nextTier={rewardsProfile.nextTier}
          onPass={() => tabNav.navigate('Scan')}
          onRewards={() => stackNav?.navigate('Rewards')}
        />

        <BeltPathCard
          rank={rank.replace(' Belt', '')}
          stripes={stripes}
          percent={68}
          sessionsToNext={sessionsToStripe}
          onPress={() => tabNav.navigate('Belt')}
        />

        <LineageHistoryCard
          image={lineage.image}
          chain={lineage.chain}
          caption={lineage.caption}
          onPress={() => stackNav?.navigate('Training')}
        />

        <CoachesPreview
          coaches={coachProfiles}
          onSeeAll={() => tabNav.navigate('Coaches')}
          onCoach={() => tabNav.navigate('Coaches')}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140 },
  hero: { ...typography.h1, color: colors.text, letterSpacing: 0.2 },
  heroAccent: { color: palette.green },
  heroSub: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
});
