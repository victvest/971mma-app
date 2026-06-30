import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Bell,
  ChevronRight,
  Link2,
  LogOut,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';

import { useAuth } from '@/features/auth/context/AuthContext';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useDisciplineScore } from '@/features/home/hooks/useHomeDashboard';
import { usePoints } from '@/features/rewards/hooks/useRewards';
import { useBeltPath } from '@/features/belt/hooks/useBeltPath';
import { useRankEligibility } from '@/features/auth/hooks/useMemberDisciplines';
import { useMembership, useMembershipRefresh } from '@/features/profile/hooks/useMembership';
import { MyGuardiansCard } from '@/features/guardian/components/MyGuardiansCard';
import { useActiveProfileLabel, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { dateOfBirthToAge } from '@/features/onboarding/services/onboardingValidation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { ProfileSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import {
  isOfflineWithoutCache,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import { HomeBeltPathCard } from '@/features/home/components/HomeBeltPathCard';
import {
  BrandedLucideIconBadge,
  CollapsibleAppBar,
  CollapsibleAppBarAction,
  type BrandedIconTone,
} from '@/shared/components/ui';
import { useDialog } from '@/shared/components/Dialog';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';
import { UaeFlagMark } from '@/shared/components/brand';
import { getAppVersionLabel } from '@/core/config/appVersion';
import type { AppColors } from '@/shared/theme/colors';
import {
  PROFILE_HERO_HEIGHT,
  ProfileAccountFooter,
  SpringPressable,
  StatCard,
  profileScreenStyles,
  profileScrollContentPadding,
  useSectionEntrance,
} from '@/features/profile/components/ProfileScreenPrimitives';

import coverImage from '../../assets/images/optimized/class-bjj-cover.jpg';

// ─── Reanimated animated SVG Circle ──────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Membership card (memoized) ───────────────────────────────────────────────
type MembershipCardProps = {
  status: string | undefined;
  planName: string | null | undefined;
  expiresAt: string | null | undefined;
  lastSyncedAt: string | null | undefined;
  isFetching: boolean;
  colors: AppColors;
  cardRadius: number;
};

const MembershipCard = React.memo(function MembershipCard({
  status,
  planName,
  expiresAt,
  lastSyncedAt,
  isFetching,
  colors,
  cardRadius,
}: MembershipCardProps) {
  const { shadows, layout } = useTheme();
  const statusConfig = useMemo(() => {
    if (status === 'active') return {
      bg: colors.status.successSubtle,
      border: colors.status.successBorder,
      text: colors.status.success,
      label: 'ACTIVE',
    };
    if (status === 'paused') return {
      bg: colors.status.warningSubtle,
      border: colors.status.warningBorder,
      text: colors.status.warning,
      label: 'PAUSED',
    };
    return {
      bg: colors.status.errorSubtle,
      border: colors.status.errorBorder,
      text: colors.status.error,
      label: 'EXPIRED',
    };
  }, [status, colors]);

  return (
    <View
      style={[
        styles.membershipCard,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: cardRadius,
          borderWidth: layout.borderWidth,
        },
      ]}
    >
      <View
        style={[
          styles.membershipAccent,
          {
            backgroundColor: colors.accent.default,
            borderTopLeftRadius: cardRadius,
            borderTopRightRadius: cardRadius,
          },
        ]}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          borderTopLeftRadius: cardRadius,
          borderTopRightRadius: cardRadius,
        }}
        pointerEvents="none"
      />
      <View style={styles.membershipInner}>
        <View style={styles.membershipTitleRow}>
          <Text style={[styles.membershipTitle, { color: colors.text.primary }]}>Membership</Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
            ]}
          >
            <Text style={[styles.statusPillText, { color: statusConfig.text }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={[styles.membershipDivider, { backgroundColor: colors.border.subtle }]} />

        <View style={styles.membershipRow}>
          <Text style={[styles.membershipRowLabel, { color: colors.text.tertiary }]}>Plan</Text>
          <Text style={[styles.membershipRowValue, { color: colors.text.primary }]}>
            {planName ?? '—'}
          </Text>
        </View>

        <View style={[styles.membershipDivider, { backgroundColor: colors.border.subtle }]} />

        <View style={styles.membershipRow}>
          <Text style={[styles.membershipRowLabel, { color: colors.text.tertiary }]}>Expires</Text>
          <Text style={[styles.membershipRowValue, { color: colors.text.primary }]}>
            {expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </Text>
        </View>

        {lastSyncedAt ? (
          <>
            <View style={[styles.membershipDivider, { backgroundColor: colors.border.subtle }]} />
            <View style={styles.membershipSyncRow}>
              <Text style={[styles.membershipSyncText, { color: colors.text.tertiary }]}>
                Synced {new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isFetching ? (
                <Text style={[styles.membershipSyncText, { color: colors.accent.default }]}>
                  Syncing…
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
});

const CardWrapper = React.memo(function CardWrapper({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.cardWrapper,
        style,
      ]}
    >
      {children}
    </View>
  );
});

const ProfileActionTile = React.memo(function ProfileActionTile({
  icon,
  title,
  subtitle,
  onPress,
  iconTone = 'neutral',
  showDivider = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  iconTone?: BrandedIconTone;
  showDivider?: boolean;
}) {
  const { colors, typography, inset, mode } = useTheme();
  const mutedBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.actionTile,
        showDivider && {
          borderBottomColor: mutedBorder,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        {
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm + 4,
          backgroundColor: pressed ? colors.fill.secondary : colors.surface.primary,
        },
      ]}
    >
      <BrandedLucideIconBadge icon={icon} tone={iconTone} />

      <View style={styles.actionTextCol}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2.25} />
    </Pressable>
  );
});




// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { colors, typography, inset, radius, gap, layout, mode } = useTheme();
  usePerfRouteMount(PerfMark.routeProfileMount);
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { showConfirm } = useDialog();
  const user = useAuthStore((s) => s.user);
  const { needsActivation } = useIsGuest();
  const activeProfileLabel = useActiveProfileLabel();
  const viewingChild = useIsViewingChildProfile();

  const [screenFocused, setScreenFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  const profileQuery = useProfile();
  const disciplineQuery = useDisciplineScore();
  const pointsQuery = usePoints();
  const rankEligibilityQuery = useRankEligibility();
  const beltPathQuery = useBeltPath();
  const membershipQuery = useMembership();
  const membershipRefresh = useMembershipRefresh(screenFocused);
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const [refreshing, setRefreshing] = useState(false);
  const [statusBarStyle, setStatusBarStyle] = useState<'light' | 'dark'>('light');

  const versionLabel = useMemo(() => getAppVersionLabel(), []);

  const profile = profileQuery.data;
  const score = disciplineQuery.data;
  const points = pointsQuery.data;
  const beltPath = beltPathQuery.data;
  const displayName = profile?.fullName || activeProfileLabel || 'Member';

  const memberAge = useMemo(() => {
    if (!profile?.dateOfBirth) return null;
    return dateOfBirthToAge(profile.dateOfBirth);
  }, [profile?.dateOfBirth]);

  const heroKicker = useMemo(() => {
    const ms = membershipQuery.data;
    if (ms?.status === 'active') return ms.planName?.toUpperCase() ?? 'ACTIVE MEMBER';
    if (ms?.status === 'paused') return 'MEMBERSHIP PAUSED';
    if (ms?.status === 'expired') return 'MEMBERSHIP EXPIRED';
    return 'NO ACTIVE PLAN';
  }, [membershipQuery.data]);

  const heroKickerColor = useMemo(() => {
    const st = membershipQuery.data?.status;
    if (st === 'active') return colors.accent.default;
    if (st === 'paused') return colors.status.warning;
    if (st === 'expired') return colors.status.error;
    return colors.text.onPromoMuted;
  }, [membershipQuery.data?.status, colors]);

  const roleLabel = useMemo(() => {
    const role = user?.role ?? 'member';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [user?.role]);

  const rankEligible = rankEligibilityQuery.data?.eligible === true;
  const hasBeltProgress = rankEligible && Boolean(beltPath?.progress);
  const formattedRankName = useMemo(() => {
    const name = beltPath?.progress?.rankName ?? 'White';
    return name.toLowerCase().includes('belt') ? name : `${name} Belt`;
  }, [beltPath?.progress?.rankName]);

  const beltPercent = hasBeltProgress ? (beltPath?.progress?.percent ?? 0) : 0;
  const beltStripe = hasBeltProgress ? (beltPath?.progress?.stripe ?? 0) : 0;
  const beltMaxStripes = hasBeltProgress ? (beltPath?.progress?.maxStripes ?? 4) : 4;
  const beltNextStripe = beltStripe < beltMaxStripes ? beltStripe + 1 : beltMaxStripes;

  const memberSinceYearLabel = useMemo(() => {
    if (!profile?.memberSince) return 'Member since 2024';
    try {
      const d = new Date(profile.memberSince);
      return `Member since ${d.getFullYear()}`;
    } catch {
      return 'Member since 2024';
    }
  }, [profile?.memberSince]);

  const consistencyRank = useMemo(() => {
    const days = score?.trainingDays ?? 0;
    if (days >= 150) return 'Top 5%';
    if (days >= 100) return 'Top 10%';
    if (days >= 50) return 'Top 15%';
    if (days >= 25) return 'Top 25%';
    if (days >= 10) return 'Top 40%';
    return 'Top 50%';
  }, [score?.trainingDays]);



  // ── Loading / error ───────────────────────────────────────────────────────
  const isLoading = needsActivation
    ? profileQuery.isLoading
    : profileQuery.isLoading || disciplineQuery.isLoading ||
      pointsQuery.isLoading || rankEligibilityQuery.isLoading ||
      (rankEligible && beltPathQuery.isLoading) || membershipQuery.isLoading;
  const hasError = needsActivation
    ? profileQuery.isError
    : profileQuery.isError || disciplineQuery.isError ||
      pointsQuery.isError || rankEligibilityQuery.isError ||
      (rankEligible && beltPathQuery.isError) || membershipQuery.isError;
  const hasData = needsActivation
    ? profileQuery.data !== undefined
    : profileQuery.data !== undefined || disciplineQuery.data !== undefined ||
      pointsQuery.data !== undefined || rankEligibilityQuery.data !== undefined ||
      beltPathQuery.data !== undefined ||
      membershipQuery.data !== undefined;
  const isInitialLoading = isLoading && !hasData;
  const dataReady = hasData && !isInitialLoading;

  usePerfOnceReady(PerfMark.routeProfileFirstContent, dataReady);

  // ── Scroll & parallax ─────────────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });

  const heroTotalH = PROFILE_HERO_HEIGHT + safeInsets.top;
  const headerRevealStart = heroTotalH - 100;
  const headerRevealEnd = heroTotalH - 10;

  useAnimatedReaction(
    () => scrollY.value >= headerRevealStart,
    (isSolid, previous) => {
      if (isSolid !== previous) {
        runOnJS(setStatusBarStyle)(isSolid ? 'dark' : 'light');
      }
    },
    [headerRevealStart],
  );

  // Parallax: image moves at 40% of scroll speed (slower = depth illusion)
  const heroImgStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, heroTotalH],
          [0, -heroTotalH * 0.4],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Belt SVG ring animation ────────────────────────────────────────────────
  const SVG_SIZE = 90;
  const SVG_STROKE = 7;
  const ringRadius = (SVG_SIZE - SVG_STROKE) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;

  const ringValue = useSharedValue(0);
  useEffect(() => {
    if (beltPercent > 0) {
      ringValue.value = withDelay(
        700,
        withTiming(beltPercent, {
          duration: 1100,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }
  }, [beltPercent, ringValue]);

  const animRingProps = useAnimatedProps(() => ({
    strokeDashoffset: ringCirc - (ringValue.value / 100) * ringCirc,
  }));

  // ── Section entrance animations ───────────────────────────────────────────
  const heroEntrance = useSectionEntrance(0, dataReady);
  const statsEntrance = useSectionEntrance(120, dataReady);
  const beltEntrance = useSectionEntrance(240, dataReady);
  const membershipEntrance = useSectionEntrance(340, dataReady);
  const bottomEntrance = useSectionEntrance(420, dataReady);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      if (needsActivation) {
        await profileQuery.refetch();
        return;
      }
      await Promise.all([
        profileQuery.refetch(),
        disciplineQuery.refetch(),
        pointsQuery.refetch(),
        rankEligibilityQuery.refetch(),
        beltPathQuery.refetch(),
        membershipQuery.refetch(),
        membershipRefresh.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    needsActivation,
    profileQuery,
    disciplineQuery,
    pointsQuery,
    rankEligibilityQuery,
    beltPathQuery,
    membershipQuery,
    membershipRefresh,
  ]);

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
    }> = [];

    if (needsActivation) {
      list.push({
        icon: Link2,
        iconTone: 'neutral',
        title: 'Complete Activation',
        subtitle: 'Link your academy membership',
        onPress: () => router.push('/activation-required'),
      });
    }

    list.push({
      icon: ShieldCheck,
      iconTone: 'neutral',
      title: 'Change Password',
      subtitle: 'Update security credentials',
      onPress: () => router.push('/change-password'),
    });

    if (!needsActivation) {
      list.push({
        icon: Bell,
        iconTone: 'neutral',
        title: 'Notification Preferences',
        subtitle: 'Choose academy, class, and reward alerts',
        onPress: () => router.push('/notifications/preferences'),
      });
    }

    if (!viewingChild) {
      list.push({
        icon: Trash2,
        iconTone: 'neutral',
        title: 'Delete Account',
        subtitle: 'Request account deletion',
        onPress: handleRequestDeletion,
      });
    }

    list.push({
      icon: LogOut,
      iconTone: 'danger',
      title: 'Logout',
      subtitle: 'Exit your current session',
      onPress: handleSignOut,
    });

    return list;
  }, [needsActivation, viewingChild, router, handleRequestDeletion, handleSignOut]);


  // ── Styles with dynamic values ─────────────────────────────────────────────
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

  // Derived render flags (mutually exclusive priority)
  const showOfflineOnly = isOfflineBlocked;
  const showErrorOnly = hasError && !hasData && !showOfflineOnly;
  const showSkeletonOnly = isInitialLoading && !hasError && !hasData && !showOfflineOnly;
  const showContent = !showOfflineOnly && !showErrorOnly && !showSkeletonOnly;
  const appBarHeight = layout.headerHeight;
  const actionGroupBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  const profileAppBarRight = !viewingChild ? (
    <CollapsibleAppBarAction
      icon="create-outline"
      onPress={() => router.push('/edit-profile')}
      accessibilityLabel="Edit profile"
      scrollY={scrollY}
      collapseStart={headerRevealStart}
      collapseEnd={headerRevealEnd}
    />
  ) : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[profileScreenStyles.screen, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style={statusBarStyle} translucent backgroundColor="transparent" />

      {/* ── Floating liquid-glass app bar ── */}
      <View
        style={[
          styles.headerRoot,
          {
            top: safeInsets.top + NAV_CHROME.topInset,
          },
        ]}
        pointerEvents="box-none"
      >
        <GlassNavChrome
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          style={styles.headerSoloCluster}
          contentStyle={styles.headerSoloContent}
        >
          <Ionicons
            name="chevron-back"
            size={NAV_CHROME.iconSize}
            color={UAE.ink}
          />
        </GlassNavChrome>

        <GlassNavChrome
          accessibilityLabel="Profile actions"
          layout="bar"
          style={styles.headerActionCapsule}
          contentStyle={[
            styles.headerActionCapsuleContent,
            viewingChild && { paddingRight: 16 }
          ]}
          borderRadius={NAV_CHROME.glassRadius}
        >
          <View style={styles.headerTitleWrapper}>
            <Text style={[typography.textPresets.bodyStrong, { color: UAE.ink, fontWeight: '700' }]}>
              Profile
            </Text>
          </View>

          {!viewingChild ? (
            <>
              <View style={styles.headerActionDivider} />
              <Pressable
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={4}
                style={({ pressed }) => [styles.headerActionCell, pressed && styles.headerPressed]}
              >
                <Ionicons name="create-outline" size={24} color={UAE.ink} />
              </Pressable>
            </>
          ) : null}
        </GlassNavChrome>
      </View>

      {/* ── Error state (no data available) ── */}
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

      {/* ── Initial loading skeleton ── */}
      {showSkeletonOnly ? (
        <View style={[profileScreenStyles.skeletonWrap, { paddingTop: safeInsets.top + appBarHeight + 16 }]}>
          <ProfileSkeleton />
        </View>
      ) : null}

      {/* ── Main scroll ── */}
      {showContent ? (
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
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
          {/* ─ Identity Section (Centered) ─ */}
          <Animated.View
            style={[
              styles.identityContainer,
              {
                paddingTop: safeInsets.top + NAV_CHROME.clusterHeight + 24,
              },
              heroEntrance,
            ]}
          >
            <View style={styles.avatarGlowContainer}>
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

            <Text style={[styles.centeredName, { color: colors.text.primary }]}>
              {displayName}
            </Text>

            {needsActivation && user?.email ? (
              <Text
                style={[
                  typography.textPresets.body,
                  { color: colors.text.secondary, textAlign: 'center', marginTop: 4 },
                ]}
              >
                {user.email}
              </Text>
            ) : null}

            {/* Member since */}
            <View style={[needsActivation ? styles.badgesColumn : styles.badgesRow, { gap: gap.sm }]}>
              {needsActivation ? (
                <>
                  {memberAge !== null ? (
                    <View style={styles.memberSinceBadge}>
                      <Ionicons name="person-outline" size={13} color={colors.text.secondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.memberSinceText, { color: colors.text.secondary }]}>
                        {memberAge} years old
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.beltBadge, { backgroundColor: colors.status.warningSubtle, borderRadius: radius.pill }]}>
                    <Ionicons name="time-outline" size={12} color={colors.status.warning} style={{ marginRight: 4 }} />
                    <Text style={[styles.beltBadgeText, { color: colors.status.warning }]}>
                      Pending activation
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.memberSinceBadge}>
                  <Ionicons name="calendar-outline" size={13} color={colors.text.secondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.memberSinceText, { color: colors.text.secondary }]}>
                    {memberSinceYearLabel}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ─ Partial error banner ─ */}
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

          {/* ─ Performance Cards (2x2 Grid) ─ */}
          {!needsActivation ? (
          <Animated.View style={[styles.sectionContainer, statsEntrance, { marginBottom: 8 }]}>
            <View style={[styles.perfCardsGrid, { gap: 12 }]}>
              {/* Row 1 */}
              <View style={styles.perfCardsRow}>
                {/* Card 1: Training Volume */}
                <View style={styles.cardWrapper}>
                  {/* Barbell Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="barbell-outline"
                      size={80}
                      color="#000000"
                      style={{ opacity: 0.07, transform: [{ rotate: '-15deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Training Volume
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {score?.trainingDays ?? 0}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Classes Completed
                  </Text>
                </View>

                {/* Card 2: Consistency */}
                <View style={styles.cardWrapper}>
                  {/* Trending Up Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="trending-up-outline"
                      size={80}
                      color="#000000"
                      style={{ opacity: 0.07, transform: [{ rotate: '-10deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Consistency
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: '#00843D' }]}>
                    {consistencyRank}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Attendance Rank
                  </Text>
                </View>
              </View>

              {/* Row 2 */}
              <View style={styles.perfCardsRow}>
                {/* Card 3: Current Streak */}
                <View style={styles.cardWrapper}>
                  {/* Flame Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="flame-outline"
                      size={80}
                      color="#000000"
                      style={{ opacity: 0.07, transform: [{ rotate: '-12deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Current Streak
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {score?.currentStreak ?? 0}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Day Streak
                  </Text>
                </View>

                {/* Card 4: Points Balance */}
                <View style={styles.cardWrapper}>
                  {/* Diamond Watermark */}
                  <View style={styles.watermarkContainer}>
                    <Ionicons
                      name="diamond-outline"
                      size={80}
                      color="#000000"
                      style={{ opacity: 0.07, transform: [{ rotate: '-8deg' }] }}
                    />
                  </View>

                  <View style={styles.perfCardHeader}>
                    <Text style={[styles.perfCardLabel, { color: colors.text.secondary }]}>
                      Points Balance
                    </Text>
                  </View>

                  <Text style={[styles.perfCardValue, { color: colors.text.primary }]}>
                    {Number(points?.balance ?? 0).toLocaleString()}
                  </Text>

                  <Text style={[styles.perfCardSub, { color: colors.text.secondary }]}>
                    Points Balance
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
          ) : null}

          {/* ─ Martial Arts Belt rank card ─ */}
          {!needsActivation && hasBeltProgress ? (
            <Animated.View style={[styles.sectionContainer, beltEntrance, { marginBottom: 8 }]}>
              <HomeBeltPathCard
                hasBeltProgress={hasBeltProgress}
                formattedBeltRank={formattedRankName}
                progressStripe={beltStripe}
                stripeProgressPercent={beltPercent}
                sessionsToNext={hasBeltProgress ? 12 - ((score?.trainingDays ?? 0) % 12) : 0}
                nextStripeNum={beltNextStripe}
                onPress={() => router.push('/(tabs)/belt-path')}
              />
            </Animated.View>
          ) : null}

          {/* ─ Account actions ─ */}
          <Animated.View style={[styles.sectionContainer, membershipEntrance, { marginBottom: 8 }]}>
            <View
              style={[
                styles.actionGroup,
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

          {/* ─ Guardians + footer ─ */}
          <Animated.View style={[bottomEntrance, { gap: inset.md }]}>
            {!viewingChild && !needsActivation ? <MyGuardiansCard /> : null}
            
            <Text style={[typography.textPresets.caption, { color: colors.text.tertiary, textAlign: 'center', marginTop: 32 }]}>
              {versionLabel}
            </Text>
          </Animated.View>


        </Animated.ScrollView>
      ) : null}


    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Belt card ──
  beltCard: {
    borderWidth: 1,
  },
  beltCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  beltInfoCol: {
    flex: 1,
    gap: 3,
    paddingRight: 16,
  },
  beltKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  beltKicker: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  beltRankName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  beltStripeTag: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  beltRingWrap: {
    width: 90,
    height: 90,
    position: 'relative',
  },
  beltRingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beltRingPct: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  beltRingTo: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  stripesSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  stripeTrack: {
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 5,
    gap: 5,
  },
  stripeSegment: {
    flex: 1,
    borderRadius: 5,
  },
  stripeLabelsRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  stripeLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // ── Floating App Bar ──
  headerRoot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    left: NAV_CHROME.horizontalInset,
    right: NAV_CHROME.horizontalInset,
    zIndex: 1000,
  },
  headerSoloCluster: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  headerSoloContent: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  headerActionCapsule: {
    minHeight: NAV_CHROME.clusterHeight,
  },
  headerActionCapsuleContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: NAV_CHROME.clusterHeight,
    paddingLeft: 16,
    paddingRight: 6,
  },
  headerTitleWrapper: {
    justifyContent: 'center',
    paddingRight: 4,
  },
  headerActionDivider: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: 30,
    marginHorizontal: 8,
    width: StyleSheet.hairlineWidth,
  },
  headerActionCell: {
    alignItems: 'center',
    height: NAV_CHROME.clusterHeight,
    justifyContent: 'center',
    width: 40,
  },
  headerPressed: {
    opacity: 0.7,
  },

  // ── Membership card ──
  membershipCard: {
    borderWidth: 1,
  },
  membershipAccent: {
    height: 3,
  },
  membershipInner: {
    padding: 16,
    paddingTop: 14,
    gap: 10,
  },
  membershipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membershipTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  membershipDivider: {
    height: StyleSheet.hairlineWidth,
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membershipRowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  membershipRowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  membershipSyncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  membershipSyncText: {
    fontSize: 11,
  },

  // ── Custom redesigned profile styles ──
  identityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  avatarGlowContainer: {
    alignSelf: 'center',
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  centeredName: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  beltBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  beltBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberSinceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberSinceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 12,
  },
  perfCardsGrid: {
    width: '100%',
  },
  perfCardsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 0,
  },
  cardWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 0,
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    zIndex: 0,
  },
  perfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  perfIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  perfCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  perfCardValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 4,
    zIndex: 1,
  },
  perfCardSub: {
    fontSize: 12,
    fontWeight: '500',
    zIndex: 1,
  },
  actionGroup: {
    overflow: 'hidden',
    width: '100%',
  },
  actionTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },

});
