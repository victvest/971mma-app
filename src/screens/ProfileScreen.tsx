import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, palette, radii, shadow, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import { Tag, ProgressBar, Label, Divider } from '../components/primitives';
import { membership, progress } from '../data/mockData';
import { useProfile } from '../hooks/useProfile';
import { EditProfileSheet } from '../components/EditProfileSheet';

const SETTINGS: { icon: keyof typeof Ionicons.glyphMap; label: string; tint?: string }[] = [
  { icon: 'card-outline', label: 'Membership & billing' },
  { icon: 'barbell-outline', label: 'Training preferences' },
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
  const tierLabel = TIER_LABEL[profile?.membershipTier ?? 'elite'] ?? 'Elite';
  const statusLabel = STATUS_LABEL[profile?.membershipStatus ?? 'active'] ?? 'Active';
  const beltRank = profile?.beltRank ?? progress.rank;
  const beltStripes = profile?.beltStripes ?? progress.stripes;

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader title="Profile" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <Card style={styles.identityCard}>
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8}>
            <Ionicons name="create-outline" size={18} color={colors.accent} />
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile?.fullName, user?.email)}</Text>
          </View>
          <Text style={styles.name}>{display}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.idRow}>
            <Tag label={`${tierLabel} member`} tone="ink" />
            {profile?.phone ? <Tag label={profile.phone} tone="neutral" /> : null}
          </View>
        </Card>

        {/* Membership */}
        <View style={styles.membershipCard}>
          <LinearGradient
            colors={[palette.greenDeep, palette.green]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.memTop}>
            <View>
              <Text style={styles.memLabel}>MEMBERSHIP</Text>
              <Text style={styles.memPlan}>{tierLabel}</Text>
            </View>
            <View style={styles.memBadge}>
              <View style={styles.memDot} />
              <Text style={styles.memBadgeText}>{statusLabel}</Text>
            </View>
          </View>
          <View style={styles.memFooter}>
            <View>
              <Text style={styles.memFootLabel}>Expires</Text>
              <Text style={styles.memFootValue}>{formatDate(profile?.membershipExpiresAt ?? null)}</Text>
            </View>
            <View>
              <Text style={styles.memFootLabel}>Check-ins</Text>
              <Text style={styles.memFootValue}>{membership.checkInsThisMonth} this month</Text>
            </View>
          </View>
        </View>

        {/* Belt progress */}
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.beltHead}>
            <View style={styles.beltBadge}>
              <Ionicons name="ribbon" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.beltRank}>{beltRank}</Text>
              <Text style={styles.beltTrack}>{progress.track} · {beltStripes} stripes</Text>
            </View>
            <Text style={styles.beltPct}>{progress.percent}%</Text>
          </View>
          <ProgressBar percent={progress.percent} />
          <Text style={styles.beltNext}>Next: {progress.nextRank}</Text>

          <Divider style={{ marginVertical: spacing.lg }} />

          <Label>Requirements</Label>
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {progress.requirements.map((r) => (
              <View key={r.id} style={styles.reqRow}>
                <Ionicons
                  name={r.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={r.done ? colors.accent : colors.textFaint}
                />
                <Text style={[styles.reqText, !r.done && { color: colors.textMuted }]}>{r.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Settings */}
        <Card style={{ marginTop: spacing.lg }} padded={false}>
          {SETTINGS.map((s, i) => (
            <Pressable
              key={s.label}
              style={({ pressed }) => [
                styles.settingRow,
                i < SETTINGS.length - 1 && styles.settingBorder,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View style={styles.settingIcon}>
                <Ionicons name={s.icon} size={19} color={colors.text} />
              </View>
              <Text style={styles.settingLabel}>{s.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>

        {/* Sign out */}
        <Pressable onPress={confirmSignOut} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.version}>971 MMA · v1.0.0</Text>
      </ScrollView>

      <EditProfileSheet
        visible={editing}
        profile={profile}
        onClose={() => setEditing(false)}
        onSave={save}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 120 },

  identityCard: { alignItems: 'center' },
  editBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  name: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  idRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  membershipCard: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    minHeight: 150,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  memTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  memLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  memPlan: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6, letterSpacing: -0.4 },
  memBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  memDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  memBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  memFooter: { flexDirection: 'row', gap: spacing.huge, marginTop: spacing.xl },
  memFootLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  memFootValue: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 3 },

  beltHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  beltBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beltRank: { ...typography.h3, color: colors.text },
  beltTrack: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  beltPct: { ...typography.h2, color: colors.accent },
  beltNext: { marginTop: spacing.md, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reqText: { fontSize: 14.5, fontWeight: '600', color: colors.text },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  version: { textAlign: 'center', color: colors.textFaint, fontSize: 12, marginTop: spacing.xl, fontWeight: '600' },
});
