import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Bell,
  LogOut,
  PersonStanding,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';

import { NAV_CHROME } from '@/features/home/components/navigation/uaeChrome';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getCoachRankLabel, getCoachRoleLabel, getCoachSpecialtyLabel } from '@/features/coaches/components/CoachVisuals';
import { useCoachDashboardStats } from '@/features/coach/hooks/useCoachMode';
import {
  useMyCoachClasses,
  useMyCoachRecord,
} from '@/features/coach/hooks/useMyCoachRecord';
import {
  ProfileActionTile,
  ProfileGlassHeader,
  ProfilePerfMetricCard,
  SpringPressable,
  profileLayoutStyles,
  profileScreenStyles,
  profileScrollContentPadding,
  useSectionEntrance,
} from '@/features/profile/components/ProfileScreenPrimitives';
import { ProfileSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { UaeFlagMark } from '@/shared/components/brand';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import {
  isOfflineWithoutCache,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import { type BrandedIconTone } from '@/shared/components/ui';
import { useDialog } from '@/shared/components/Dialog';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAppVersionLabel } from '@/core/config/appVersion';

export function CoachProfileScreen() {
  const { colors, typography, inset, radius, layout, mode } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { showConfirm } = useDialog();
  const user = useAuthStore((s) => s.user);
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const { coach, profileQuery, isLoading, isError } = useMyCoachRecord();
  const classesQuery = useMyCoachClasses(coach);
  const statsQuery = useCoachDashboardStats();

  const [refreshing, setRefreshing] = useState(false);

  const versionLabel = useMemo(() => getAppVersionLabel(), []);

  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const weekClassCount = classesQuery.data?.length ?? 0;

  const displayName = profile?.fullName ?? user?.email?.split('@')[0] ?? 'Coach';

  const coachBadgeLabel = useMemo(() => {
    if (coach) return getCoachRoleLabel(coach);
    if (profile?.memberSince) {
      try {
        return `Coach since ${new Date(profile.memberSince).getFullYear()}`;
      } catch {
        return 'Coach';
      }
    }
    return 'Coach';
  }, [coach, profile?.memberSince]);

  const hasData = profile !== undefined || coach !== null || stats !== undefined;
  const hasError = isError;
  const isInitialLoading = isLoading && !hasData;
  const dataReady = hasData && !isInitialLoading;

  const heroEntrance = useSectionEntrance(0, dataReady);
  const statsEntrance = useSectionEntrance(120, dataReady);
  const credentialsEntrance = useSectionEntrance(240, dataReady);
  const actionsEntrance = useSectionEntrance(340, dataReady);
  const bottomEntrance = useSectionEntrance(420, dataReady);

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await Promise.all([
        profileQuery.refetch(),
        classesQuery.refetch(),
        statsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [classesQuery, profileQuery, statsQuery]);

  const handleSignOut = useCallback(() => {
    showConfirm(
      'Sign out?',
      'You will need to sign in again to access your account.',
      signOut,
      { confirmLabel: 'Sign out' },
    );
  }, [showConfirm, signOut]);

  const handleRequestDeletion = useCallback(() => {
    router.push('/delete-account');
  }, [router]);

  const accountOptions = useMemo(() => {
    const list: Array<{
      icon: LucideIcon;
      title: string;
      subtitle: string;
      onPress: () => void;
      iconTone?: BrandedIconTone;
    }> = [
      {
        icon: PersonStanding,
        iconTone: 'neutral',
        title: 'Switch to member mode',
        subtitle: 'Return to your member experience',
        onPress: () => router.replace('/(tabs)'),
      },
      {
        icon: ShieldCheck,
        iconTone: 'neutral',
        title: 'Change Password',
        subtitle: 'Update security credentials',
        onPress: () => router.push('/change-password'),
      },
      {
        icon: Bell,
        iconTone: 'neutral',
        title: 'Notification Preferences',
        subtitle: 'Choose academy, class, and reward alerts',
        onPress: () => router.push('/notifications/preferences'),
      },
      {
        icon: Trash2,
        iconTone: 'neutral',
        title: 'Delete Account',
        subtitle: 'Request account deletion',
        onPress: handleRequestDeletion,
      },
      {
        icon: LogOut,
        iconTone: 'danger',
        title: 'Logout',
        subtitle: 'Exit your current session',
        onPress: handleSignOut,
      },
    ];

    return list;
  }, [handleRequestDeletion, handleSignOut, router]);

  const contentPadding = useMemo(
    () => profileScrollContentPadding(safeInsets.bottom, inset.lg, inset.md),
    [inset.lg, inset.md, safeInsets.bottom],
  );

  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });

  const showOfflineOnly = isOfflineBlocked;
  const showErrorOnly = hasError && !hasData && !showOfflineOnly;
  const showSkeletonOnly = isInitialLoading && !hasError && !hasData && !showOfflineOnly;
  const showContent = !showOfflineOnly && !showErrorOnly && !showSkeletonOnly;
  const appBarHeight = layout.headerHeight;
  const actionGroupBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <View style={[profileScreenStyles.screen, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style="dark" translucent backgroundColor="transparent" />

      <ProfileGlassHeader
        safeTop={safeInsets.top}
        onBackPress={() => router.back()}
        onEditPress={() => router.push('/edit-profile')}
      />

      {showOfflineOnly ? (
        <View style={[profileScreenStyles.stateCenter, { paddingTop: safeInsets.top + 80 }]}>
          <StateBlock
            kind="error"
            title={OFFLINE_TITLE}
            message={OFFLINE_MESSAGE}
            actionLabel="Retry"
            onAction={handleRefresh}
            offlineAwareRetry
          />
        </View>
      ) : null}

      {showErrorOnly ? (
        <View style={[profileScreenStyles.stateCenter, { paddingTop: safeInsets.top + 80 }]}>
          <StateBlock
            kind="error"
            title="Could not load profile"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={handleRefresh}
            offlineAwareRetry
          />
        </View>
      ) : null}

      {showSkeletonOnly ? (
        <View style={[profileScreenStyles.skeletonWrap, { paddingTop: safeInsets.top + appBarHeight + 16 }]}>
          <ProfileSkeleton />
        </View>
      ) : null}

      {showContent ? (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={contentPadding}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              progressViewOffset={safeInsets.top + appBarHeight}
            />
          }
        >
          <Animated.View
            style={[
              profileLayoutStyles.identityContainer,
              {
                paddingTop: safeInsets.top + NAV_CHROME.clusterHeight + 24,
              },
              heroEntrance,
            ]}
          >
            <View style={profileLayoutStyles.avatarGlowContainer}>
              <MemberAvatar
                name={displayName}
                avatarUrl={profile?.avatarUrl}
                size={110}
                borderWidth={4}
                borderColor="#FFFFFF"
                backgroundColor={colors.accent.default}
                textColor={colors.text.inverse}
                initialsStyle={{ fontSize: 36, fontWeight: '900' }}
              />
            </View>

            <Text style={[profileLayoutStyles.centeredName, { color: colors.text.primary }]}>
              {displayName}
            </Text>

            {user?.email ? (
              <Text
                style={[
                  typography.textPresets.body,
                  { color: colors.text.secondary, textAlign: 'center', marginTop: 4 },
                ]}
              >
                {user.email}
              </Text>
            ) : null}

            <View style={[profileLayoutStyles.memberSinceBadge, { marginTop: 10 }]}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={colors.text.secondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[profileLayoutStyles.memberSinceText, { color: colors.text.secondary }]}>
                {coachBadgeLabel}
              </Text>
            </View>
          </Animated.View>

          {hasError && hasData ? (
            <View style={{ marginBottom: 4 }}>
              <StateBlock
                kind="error"
                title="Sync issue"
                message="Some details could not be refreshed."
                actionLabel="Retry"
                onAction={handleRefresh}
              />
            </View>
          ) : null}

          <Animated.View style={[profileLayoutStyles.sectionContainer, statsEntrance, { marginBottom: 8 }]}>
            <View style={[profileLayoutStyles.perfCardsGrid, { gap: 12 }]}>
              <View style={profileLayoutStyles.perfCardsRow}>
                <ProfilePerfMetricCard
                  label="Today's Classes"
                  value={stats?.todayClassCount ?? 0}
                  subtitle="Scheduled Today"
                  iconName="calendar-outline"
                  textColor={colors.text.primary}
                  secondaryTextColor={colors.text.secondary}
                />
                <ProfilePerfMetricCard
                  label="Check-ins"
                  value={stats?.todayCheckIns ?? 0}
                  subtitle="Today's Attendance"
                  iconName="people-outline"
                  textColor={colors.text.primary}
                  secondaryTextColor={colors.text.secondary}
                  valueColor="#00843D"
                />
              </View>

              <View style={[profileLayoutStyles.perfCardsRow, { marginTop: 12 }]}>
                <ProfilePerfMetricCard
                  label="In Queue"
                  value={stats?.promotionCandidateCount ?? 0}
                  subtitle="Promotion Reviews"
                  iconName="ribbon-outline"
                  textColor={colors.text.primary}
                  secondaryTextColor={colors.text.secondary}
                />
                <ProfilePerfMetricCard
                  label="This Week"
                  value={weekClassCount}
                  subtitle="Classes Scheduled"
                  iconName="time-outline"
                  textColor={colors.text.primary}
                  secondaryTextColor={colors.text.secondary}
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[profileLayoutStyles.sectionContainer, credentialsEntrance, { marginBottom: 8 }]}>
            <SpringPressable>
              <View
                style={[
                  profileScreenStyles.promoCard,
                  {
                    backgroundColor: colors.surface.promo,
                    borderColor: colors.border.onPromo,
                    borderRadius: radius.cardLarge,
                    overflow: 'hidden',
                  },
                ]}
              >
                <View style={[profileScreenStyles.accentBar, { backgroundColor: colors.accent.default }]} />
                <View style={profileScreenStyles.promoCardBody}>
                  <View style={profileScreenStyles.promoInfoCol}>
                    <View style={profileScreenStyles.promoKickerRow}>
                      <UaeFlagMark />
                      <Text style={[profileScreenStyles.promoKicker, { color: colors.text.onPromoMuted }]}>
                        Coach credentials
                      </Text>
                    </View>
                    <Text
                      style={[profileScreenStyles.promoTitle, { color: colors.text.onPromo }]}
                      numberOfLines={1}
                    >
                      {coach ? getCoachRankLabel(coach) : 'Staff profile pending'}
                    </Text>
                    <Text style={[profileScreenStyles.promoSubtitle, { color: colors.text.onPromoMuted }]}>
                      {coach?.specialty
                        ? `${getCoachSpecialtyLabel(coach)} · ${weekClassCount} classes this week`
                        : 'Match your staff profile to unlock full coach details.'}
                    </Text>
                  </View>
                </View>
              </View>
            </SpringPressable>
          </Animated.View>

          <Animated.View style={[profileLayoutStyles.sectionContainer, actionsEntrance, { marginBottom: 8 }]}>
            <View
              style={[
                profileLayoutStyles.actionGroup,
                {
                  backgroundColor: colors.surface.primary,
                  borderColor: actionGroupBorder,
                  borderRadius: radius.card,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              {accountOptions.map((opt, index) => (
                <ProfileActionTile
                  key={opt.title}
                  icon={opt.icon}
                  title={opt.title}
                  subtitle={opt.subtitle}
                  onPress={opt.onPress}
                  iconTone={opt.iconTone}
                  showDivider={index < accountOptions.length - 1}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View style={[bottomEntrance, { gap: inset.md }]}>
            <Text
              style={[
                typography.textPresets.caption,
                { color: colors.text.tertiary, textAlign: 'center', marginTop: 32 },
              ]}
            >
              {versionLabel}
            </Text>
          </Animated.View>
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}
