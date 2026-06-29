import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AppScrollView } from '@/shared/components/ui';
import { AcademyEyebrow } from '@/shared/components/brand';
import { useActiveProfileOptions, useGuardianLinks } from '@/features/guardian/hooks/useGuardian';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { PremiumLockOverlay } from '@/shared/components/PremiumLockOverlay';
import { useTheme } from '@/shared/theme';
import type { GuardianLinkItem } from '@/types/domain';

type ProfileRowProps = {
  name: string;
  selected: boolean;
  pending?: boolean;
  avatarUrl?: string | null;
  onPress?: () => void;
};

function ProfileRow({ name, selected, pending = false, avatarUrl, onPress }: ProfileRowProps) {
  const { colors, typography, inset } = useTheme();
  const initial = name.trim().slice(0, 1).toUpperCase() || 'M';
  const isInteractive = Boolean(onPress) && !pending;

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !isInteractive }}
      accessibilityLabel={
        pending ? `${name}, awaiting approval` : selected ? `${name}, active profile` : `Switch to ${name}`
      }
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm + 2,
          opacity: isInteractive && pressed ? 0.7 : 1,
          backgroundColor: selected ? colors.accent.subtle : 'transparent',
        },
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { backgroundColor: colors.fill.secondary }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={avatarUrl}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.fill.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.text.secondary }]}>{initial}</Text>
        </View>
      )}

      <View style={styles.nameBlock}>
        <Text
          style={[
            typography.textPresets.bodyStrong,
            styles.name,
            { color: pending ? colors.text.secondary : colors.text.primary },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {pending ? (
          <Text style={[styles.pendingLabel, { color: colors.text.tertiary }]}>Awaiting approval</Text>
        ) : selected ? (
          <Text style={[styles.pendingLabel, { color: colors.accent.default }]}>Active profile</Text>
        ) : null}
      </View>

      {pending ? (
        <Ionicons name="hourglass-outline" size={18} color={colors.text.tertiary} />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.accent.default} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      )}
    </Pressable>
  );
}

function RowDivider() {
  const { colors, inset } = useTheme();
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: colors.border.subtle,
          marginLeft: inset.md + 44 + inset.sm,
        },
      ]}
    />
  );
}

export function FamilyTraineesScreenContent() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const isGuest = role === 'guest' || (role === 'member' && user?.accountStatus !== 'active');
  const activeUserId = useActiveProfileStore((s) => s.activeUserId);
  const setActiveUserId = useActiveProfileStore((s) => s.setActiveUserId);
  const linksQuery = useGuardianLinks();
  const { options: activeProfileOptions } = useActiveProfileOptions();
  const [refreshing, setRefreshing] = useState(false);

  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const listLinks = useMemo(
    () =>
      links
        .filter((link) => link.status === 'approved' || link.status === 'pending')
        .sort((a, b) => {
          if (a.status === b.status) return a.childDisplayName.localeCompare(b.childDisplayName);
          return a.status === 'pending' ? 1 : -1;
        }),
    [links],
  );

  const profileOptionsByUserId = useMemo(
    () => new Map(activeProfileOptions.map((option) => [option.userId, option])),
    [activeProfileOptions],
  );

  const selectedTraineeId = activeUserId && activeUserId !== authUserId ? activeUserId : null;
  const selfLabel = user?.fullName?.trim() || 'Me';
  const isSelfSelected = !selectedTraineeId;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await linksQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [linksQuery]);

  const handleSwitchToSelf = useCallback(() => {
    if (isSelfSelected) return;
    setActiveUserId(null);
    router.replace('/(tabs)');
  }, [isSelfSelected, router, setActiveUserId]);

  const handleSwitch = useCallback(
    (link: GuardianLinkItem) => {
      if (!link.traineeUserId || link.status !== 'approved') return;
      if (link.traineeUserId === selectedTraineeId) return;
      setActiveUserId(link.traineeUserId);
      router.replace('/(tabs)');
    },
    [router, selectedTraineeId, setActiveUserId],
  );

  const resolveLinkAvatar = useCallback(
    (link: GuardianLinkItem) => {
      if (link.traineeUserId) {
        return profileOptionsByUserId.get(link.traineeUserId)?.avatarUrl ?? link.childAvatarUrl;
      }
      return link.childAvatarUrl;
    },
    [profileOptionsByUserId],
  );

  return (
    <View style={styles.root}>
      <AppScrollView
        contentContainerStyle={[styles.scrollContent, { padding: inset.lg, gap: gap.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: gap.xs }}>
          <AcademyEyebrow label="971 MMA · Family" accent />
          <Text style={[typography.textPresets.homeHero, { color: colors.text.primary, lineHeight: 42 }]}>
            Switch profile
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Choose whose progress you want to see in the app.
          </Text>
        </View>

        <View
          style={[
            styles.listShell,
            {
              borderRadius: radius.cardLarge,
              borderColor: colors.border.subtle,
              borderWidth: layout.borderWidth,
              backgroundColor: colors.surface.primary,
              overflow: 'hidden',
            },
          ]}
        >
          <ProfileRow
            name={selfLabel}
            selected={isSelfSelected}
            avatarUrl={profileOptionsByUserId.get(authUserId)?.avatarUrl ?? null}
            onPress={isSelfSelected ? undefined : handleSwitchToSelf}
          />

          {listLinks.map((link) => {
            const isSelected = Boolean(link.traineeUserId && link.traineeUserId === selectedTraineeId);
            const canSwitch = link.status === 'approved' && link.traineeUserId && !isSelected;

            return (
              <React.Fragment key={link.id}>
                <RowDivider />
                <ProfileRow
                  name={link.childDisplayName}
                  selected={isSelected}
                  pending={link.status === 'pending'}
                  avatarUrl={resolveLinkAvatar(link)}
                  onPress={canSwitch ? () => handleSwitch(link) : undefined}
                />
              </React.Fragment>
            );
          })}

          {linksQuery.isLoading ? (
            <>
              <RowDivider />
              <View style={[styles.loadingRow, { padding: inset.md }]}>
                <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>Loading…</Text>
              </View>
            </>
          ) : null}
        </View>
      </AppScrollView>

      {!linksQuery.isLoading && listLinks.length === 0 ? (
        <View style={[styles.footer, { paddingHorizontal: inset.lg, paddingBottom: inset.lg }]}>
          <Text style={[styles.staffNote, { color: colors.text.secondary }]}>
            Ask the front desk to link a child or teen to your account.
          </Text>
        </View>
      ) : null}

      {isGuest ? (
        <PremiumLockOverlay
          title="Family profiles"
          description="Switch between family profiles after your membership is active."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  listShell: { width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  nameBlock: { flex: 1, minWidth: 0, gap: 2 },
  name: {},
  pendingLabel: { fontSize: 12, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  loadingRow: { alignItems: 'center' },
  footer: { paddingTop: 4 },
  staffNote: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 340,
  },
});
