import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { Tag, ProgressBar } from '../components/primitives';
import { membership, progress } from '../data/mockData';
import { useProfile } from '../hooks/useProfile';
import { EditProfileSheet } from '../components/EditProfileSheet';

const SETTINGS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'card-outline', label: 'Membership & billing' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'shield-checkmark-outline', label: 'Privacy & security' },
  { icon: 'help-circle-outline', label: 'Help & support' },
];

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
      <AppHeader title="Profile" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassSurface style={styles.identityCard}>
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8} accessibilityLabel="Edit profile">
            <Ionicons name="create-outline" size={18} color={colors.accent} />
          </Pressable>
          <View style={styles.avatar}>
            <LinearGradient
              colors={[palette.greenBright, palette.green]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarFill}
            >
              <Text style={styles.avatarText}>{initials(profile?.fullName, user?.email)}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.name}>{display}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.idRow}>
            <Tag label={tierLabel} tone={isElite ? 'gold' : 'green'} />
            <Tag label={statusLabel} tone="neutral" />
          </View>
        </GlassSurface>

        <View style={styles.membershipCard}>
          <LinearGradient
            colors={cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
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
              <Text style={[styles.memFootLabel, { color: onCardMuted }]}>Check-ins</Text>
              <Text style={[styles.memFootValue, { color: onCard }]}>{membership.checkInsThisMonth} this month</Text>
            </View>
          </View>
        </View>

        <GlassSurface tone="green" style={{ marginTop: spacing.lg }}>
          <View style={styles.beltHead}>
            <Ionicons name="ribbon-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.beltRank}>{beltRank} · {beltStripes} stripes</Text>
              <Text style={styles.beltTrack}>{progress.track}</Text>
            </View>
            <Text style={styles.beltPct}>{progress.percent}%</Text>
          </View>
          <ProgressBar percent={progress.percent} />
          <Text style={styles.beltNext}>Next: {progress.nextRank}</Text>
        </GlassSurface>

        <GlassSurface style={{ marginTop: spacing.lg }} padding={false}>
          {SETTINGS.map((s, i) => (
            <Pressable
              key={s.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.settingRow,
                i < SETTINGS.length - 1 && styles.settingBorder,
                pressed && { backgroundColor: palette.glass08 },
              ]}
            >
              <View style={styles.settingIcon}>
                <Ionicons name={s.icon} size={19} color={colors.text} />
              </View>
              <Text style={styles.settingLabel}>{s.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </GlassSurface>

        <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={19} color={palette.redBright} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.version}>971 MMA · v1.0.0</Text>
      </ScrollView>

      <EditProfileSheet visible={editing} profile={profile} onClose={() => setEditing(false)} onSave={save} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 132 },

  identityCard: { alignItems: 'center' },
  editBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: { width: 86, height: 86, borderRadius: 43, overflow: 'hidden' },
  avatarFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.displayBlack, fontSize: 32 },
  name: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  idRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

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

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: palette.glass08,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.text },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(232,25,44,0.25)',
    backgroundColor: palette.redGlass,
  },
  signOutText: { color: palette.redBright, fontFamily: fonts.semi, fontSize: 15 },
  version: { textAlign: 'center', color: colors.textFaint, fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.xl },
});
