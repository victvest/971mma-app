import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { Tag, ProgressBar } from '../components/primitives';
import { membership, progress } from '../data/mockData';
import { beltJourney, rewardsProfile } from '../data/memberFeatures';
import { useProfile } from '../hooks/useProfile';
import { EditProfileSheet } from '../components/EditProfileSheet';
import type { MainStackParamList, TabsParamList } from '../navigation/types';

const TIER_LABEL: Record<string, string> = { standard: 'Standard', pro: 'Pro', elite: 'Elite' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', paused: 'Paused', expired: 'Expired' };

function initials(name?: string, email?: string | null) {
  if (name) {
    const parts = name.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (email?.[0] ?? 'M').toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, save } = useProfile();
  const tabNav = useNavigation<BottomTabNavigationProp<TabsParamList, 'Profile'>>();
  const stackNav = tabNav.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const [editing, setEditing] = useState(false);

  const display = profile?.fullName || user?.email?.split('@')[0] || 'Member';
  const tier = profile?.membershipTier ?? 'elite';
  const tierLabel = TIER_LABEL[tier] ?? 'Elite';
  const statusLabel = STATUS_LABEL[profile?.membershipStatus ?? 'active'] ?? 'Active';
  const beltRank = profile?.beltRank ?? progress.rank;
  const beltStripes = profile?.beltStripes ?? progress.stripes;

  const isElite = tier === 'elite';
  const cardGradient: readonly [string, string, ...string[]] = isElite
    ? [palette.goldDeep, palette.gold, palette.goldBright]
    : [palette.greenDeep, palette.greenCore, palette.green];
  const onCard = isElite ? '#1B1403' : '#EAFBF1';
  const onCardMuted = isElite ? 'rgba(27,20,3,0.7)' : 'rgba(234,251,241,0.75)';

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Profile" subtitle={membership.memberId} showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Horizontal member ID — not centered avatar card */}
        <GlassSurface strong padding={spacing.lg}>
          <View style={styles.identityRow}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={[palette.greenBright, palette.green]} style={styles.avatarFill}>
                <Text style={styles.avatarText}>{initials(profile?.fullName, user?.email)}</Text>
              </LinearGradient>
            </View>
            <View style={styles.identityBody}>
              <View style={styles.identityTop}>
                <Text style={styles.displayName} numberOfLines={1}>{display}</Text>
                <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityLabel="Edit profile">
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                </Pressable>
              </View>
              <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
              <View style={styles.metaRow}>
                <Tag label={tierLabel} tone={isElite ? 'gold' : 'green'} />
                <Tag label={statusLabel} tone="neutral" />
                <Tag label={`${beltRank}`} tone="green" />
              </View>
            </View>
          </View>

          <View style={styles.quickStats}>
            <QuickStat label="Sessions" value={String(membership.checkInsThisMonth)} onPress={() => stackNav?.navigate('Training')} />
            <QuickStat label="Points" value={String(rewardsProfile.points)} onPress={() => stackNav?.navigate('Rewards')} />
            <QuickStat label="Belt" value={`${beltStripes} stripes`} onPress={() => stackNav?.navigate('BeltJourney')} />
          </View>
        </GlassSurface>

        <View style={styles.membershipCard}>
          <LinearGradient colors={cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.memSheen}
            pointerEvents="none"
          />
          <View style={styles.memTop}>
            <View>
              <Text style={[styles.memLabel, { color: onCardMuted }]}>Membership</Text>
              <Text style={[styles.memPlan, { color: onCard }]}>{tierLabel}</Text>
            </View>
            <View style={[styles.memBadge, { backgroundColor: isElite ? 'rgba(27,20,3,0.18)' : 'rgba(255,255,255,0.2)' }]}>
              <View style={[styles.memDot, { backgroundColor: onCard }]} />
              <Text style={[styles.memBadgeText, { color: onCard }]}>{statusLabel}</Text>
            </View>
          </View>
          <View style={styles.memFooter}>
            <View>
              <Text style={[styles.memFootLabel, { color: onCardMuted }]}>Renews</Text>
              <Text style={[styles.memFootValue, { color: onCard }]}>{formatDate(profile?.membershipExpiresAt ?? null)}</Text>
            </View>
            <View>
              <Text style={[styles.memFootLabel, { color: onCardMuted }]}>Member since</Text>
              <Text style={[styles.memFootValue, { color: onCard }]}>{membership.memberSince}</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => stackNav?.navigate('BeltJourney')}>
          <GlassSurface tone="green" style={{ marginTop: spacing.lg }}>
            <View style={styles.beltHead}>
              <Ionicons name="ribbon-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.beltRank}>{beltRank} · {beltStripes} stripes</Text>
                <Text style={styles.beltTrack}>{beltJourney.track}</Text>
              </View>
              <Text style={styles.beltPct}>{beltJourney.percent}%</Text>
            </View>
            <ProgressBar percent={beltJourney.percent} />
            <Text style={styles.beltNext}>Coach assessment · {beltJourney.coachAssessment.date}</Text>
          </GlassSurface>
        </Pressable>

        <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={19} color={palette.red} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.version}>971 MMA · v1.0.0</Text>
      </ScrollView>

      <EditProfileSheet visible={editing} profile={profile} onClose={() => setEditing(false)} onSave={save} />
    </ScreenShell>
  );
}

function QuickStat({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickStat} onPress={onPress} accessibilityRole="button">
      <Text style={styles.quickValue}>{value}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 132 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.greenLine,
  },
  avatarFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.displayBold, fontSize: 22 },
  identityBody: { flex: 1, minWidth: 0 },
  identityTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  displayName: { ...typography.h2, color: colors.text, flex: 1 },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  quickStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  quickStat: {
    flex: 1,
    backgroundColor: palette.inset,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  quickValue: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.text },
  quickLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  membershipCard: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  memSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  memTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  memLabel: { fontFamily: fonts.medium, fontSize: 13 },
  memPlan: { fontFamily: fonts.displayBlack, fontSize: 28, marginTop: 4, letterSpacing: 0.2 },
  memBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  memDot: { width: 7, height: 7, borderRadius: 4 },
  memBadgeText: { fontFamily: fonts.semi, fontSize: 12 },
  memFooter: { flexDirection: 'row', gap: spacing.huge, marginTop: spacing.xl },
  memFootLabel: { fontFamily: fonts.medium, fontSize: 12 },
  memFootValue: { fontFamily: fonts.semi, fontSize: 15, marginTop: 3 },

  beltHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  beltRank: { fontFamily: fonts.semi, fontSize: 16, color: colors.text },
  beltTrack: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  beltPct: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.accent },
  beltNext: { marginTop: spacing.md, fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.redLine,
    backgroundColor: palette.redGlass,
  },
  signOutText: { color: palette.red, fontFamily: fonts.semi, fontSize: 15 },
  version: { textAlign: 'center', color: colors.textFaint, fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.xl },
});
