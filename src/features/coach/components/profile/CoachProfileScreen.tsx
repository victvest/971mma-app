import React, { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getCoachRankLabel,
  getCoachRoleLabel,
  getCoachSpecialtyLabel,
} from '@/features/coaches/components/CoachVisuals';
import { DisciplinePill } from '@/features/coaches/components/CoachVisuals';
import { useCoachDashboardStats } from '@/features/coach/hooks/useCoachMode';
import {
  useMyCoachClasses,
  useMyCoachDisciplines,
  useMyCoachRecord,
} from '@/features/coach/hooks/useMyCoachRecord';
import {
  PROFILE_HERO_HEIGHT,
  ProfileAccountFooter,
  SpringPressable,
  StatCard,
  profileScreenStyles,
  profileScrollContentPadding,
  useSectionEntrance,
} from '@/features/profile/components/ProfileScreenPrimitives';
import { ProfileSkeleton } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { CollapsibleAppBar, CollapsibleAppBarAction } from '@/shared/components/ui';
import { useDialog } from '@/shared/components/Dialog';
import { useTheme } from '@/shared/theme';
import { UaeFlagMark } from '@/shared/components/brand';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAppVersionLabel } from '@/core/config/appVersion';

import coverImage from '../../../../../assets/images/optimized/class-bjj-cover.jpg';

export function CoachProfileScreen() {
  const { colors, inset, radius, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { showConfirm } = useDialog();
  const user = useAuthStore((s) => s.user);

  const { coach, profileQuery, isLoading, isError } = useMyCoachRecord();
  const classesQuery = useMyCoachClasses(coach);
  const disciplines = useMyCoachDisciplines(coach, classesQuery.data);
  const statsQuery = useCoachDashboardStats();

  const [refreshing, setRefreshing] = useState(false);
  const [statusBarStyle, setStatusBarStyle] = useState<'light' | 'dark'>('light');

  const versionLabel = useMemo(() => getAppVersionLabel(), []);

  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const weekClassCount = classesQuery.data?.length ?? 0;

  const displayName = profile?.fullName ?? user?.email?.split('@')[0] ?? 'Coach';
  const roleLabel = 'Coach';

  const heroKicker = useMemo(() => {
    if (coach) return getCoachRoleLabel(coach).toUpperCase();
    return 'COACH PROFILE';
  }, [coach]);

  const heroKickerColor = colors.accent.default;

  const heroMetaChips = useMemo(() => {
    const chips: string[] = [];
    if (coach) {
      chips.push(getCoachSpecialtyLabel(coach));
      if (weekClassCount > 0) {
        chips.push(`${weekClassCount} classes this week`);
      }
    }
    return chips;
  }, [coach, weekClassCount]);

  const hasData = profile !== undefined || coach !== null || stats !== undefined;
  const isInitialLoading = isLoading && !hasData;
  const dataReady = hasData && !isInitialLoading;
  const showErrorOnly = isError && !hasData;
  const showSkeletonOnly = isInitialLoading && !isError && !hasData;
  const showContent = !showErrorOnly && !showSkeletonOnly;

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

  const heroEntrance = useSectionEntrance(0, dataReady);
  const statsEntrance = useSectionEntrance(120, dataReady);
  const disciplinesEntrance = useSectionEntrance(240, dataReady);
  const credentialsEntrance = useSectionEntrance(340, dataReady);
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

  const contentPadding = useMemo(
    () => profileScrollContentPadding(safeInsets.bottom, inset.lg, inset.md),
    [inset.lg, inset.md, safeInsets.bottom],
  );

  const appBarHeight = layout.headerHeight;

  const profileAppBarRight = (
    <CollapsibleAppBarAction
      icon="create-outline"
      onPress={() => router.push('/edit-profile')}
      accessibilityLabel="Edit profile"
      scrollY={scrollY}
      collapseStart={headerRevealStart}
      collapseEnd={headerRevealEnd}
    />
  );

  return (
    <View style={[profileScreenStyles.screen, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style={statusBarStyle} translucent backgroundColor="transparent" />

      <CollapsibleAppBar
        title="Profile"
        scrollY={scrollY}
        collapseStart={headerRevealStart}
        collapseEnd={headerRevealEnd}
        onBackPress={() => router.back()}
        rightElement={profileAppBarRight}
      />

      {showErrorOnly ? (
        <View style={[profileScreenStyles.stateCenter, { paddingTop: safeInsets.top + 80 }]}>
          <StateBlock
            kind="error"
            title="Could not load profile"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={handleRefresh}
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
          <Animated.View
            style={[
              profileScreenStyles.heroSection,
              { height: heroTotalH, marginHorizontal: -inset.lg },
              heroEntrance,
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, heroImgStyle]}>
              <Image
                source={coverImage}
                style={[profileScreenStyles.heroImage, { height: heroTotalH + 140 }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </Animated.View>

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.94)']}
              locations={[0, 0.3, 0.62, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View
              style={[
                profileScreenStyles.heroContent,
                {
                  paddingTop: safeInsets.top + 62,
                  paddingHorizontal: inset.lg,
                  paddingBottom: 28,
                },
              ]}
            >
              <View
                style={[
                  profileScreenStyles.heroKickerBadge,
                  {
                    backgroundColor: `${heroKickerColor}25`,
                    borderColor: `${heroKickerColor}55`,
                  },
                ]}
              >
                <UaeFlagMark />
                <Text style={[profileScreenStyles.heroKickerText, { color: heroKickerColor }]}>
                  {heroKicker}
                </Text>
              </View>

              <View style={[profileScreenStyles.identityRow, { marginTop: 14 }]}>
                <MemberAvatar
                  name={displayName}
                  avatarUrl={profile?.avatarUrl}
                  size={80}
                  borderWidth={2.5}
                  borderColor={colors.accent.default}
                  backgroundColor={colors.accent.default}
                  textColor={colors.text.inverse}
                  initialsStyle={profileScreenStyles.avatarInitials}
                />

                <View style={profileScreenStyles.identityText}>
                  <Text style={profileScreenStyles.heroName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={profileScreenStyles.heroRole} numberOfLines={1}>
                    {roleLabel}
                  </Text>
                  {heroMetaChips.length > 0 ? (
                    <View style={profileScreenStyles.heroMetaRow}>
                      {heroMetaChips.map((chip) => (
                        <Text key={chip} style={profileScreenStyles.heroMetaChip} numberOfLines={1}>
                          {chip}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {user?.email ? (
                    <Text style={profileScreenStyles.heroEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>

          {isError && hasData ? (
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

          <Animated.View style={statsEntrance}>
            <Text style={[profileScreenStyles.sectionEyebrow, { color: colors.text.tertiary }]}>
              COACHING SNAPSHOT
            </Text>
            <View style={[profileScreenStyles.statsGrid, { gap: gap.sm }]}>
              <View style={profileScreenStyles.statsRow}>
                <StatCard
                  value={stats?.todayClassCount ?? 0}
                  label="Today's Classes"
                  accentColor={colors.accent.default}
                  bgColor={colors.background.elevated}
                  textColor={colors.text.primary}
                  labelColor={colors.text.tertiary}
                  borderColor={`${colors.accent.default}30`}
                  cardRadius={radius.cardLarge}
                  iconName="calendar-outline"
                />
                <StatCard
                  value={stats?.todayCheckIns ?? 0}
                  label="Check-ins"
                  accentColor={colors.status.success}
                  bgColor={colors.background.elevated}
                  textColor={colors.text.primary}
                  labelColor={colors.text.tertiary}
                  borderColor={colors.status.successBorder}
                  cardRadius={radius.cardLarge}
                  iconName="people-outline"
                />
              </View>
              <View style={profileScreenStyles.statsRow}>
                <StatCard
                  value={stats?.promotionCandidateCount ?? 0}
                  label="In Queue"
                  accentColor={colors.status.warning}
                  bgColor={colors.background.elevated}
                  textColor={colors.text.primary}
                  labelColor={colors.text.tertiary}
                  borderColor={colors.status.warningBorder}
                  cardRadius={radius.cardLarge}
                  iconName="ribbon-outline"
                />
                <StatCard
                  value={weekClassCount}
                  label="This Week"
                  accentColor={colors.accent.default}
                  bgColor={colors.background.elevated}
                  textColor={colors.text.primary}
                  labelColor={colors.text.tertiary}
                  borderColor={`${colors.accent.default}30`}
                  cardRadius={radius.cardLarge}
                  iconName="time-outline"
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View style={disciplinesEntrance}>
            <Text style={[profileScreenStyles.sectionEyebrow, { color: colors.text.tertiary }]}>
              DISCIPLINES
            </Text>
            {disciplines.length > 0 ? (
              <View style={profileScreenStyles.disciplineRow}>
                {disciplines.map((label) => (
                  <DisciplinePill key={label} label={label} elevated />
                ))}
              </View>
            ) : (
              <Text style={[profileScreenStyles.promoSubtitle, { color: colors.text.secondary }]}>
                {coach
                  ? `${getCoachSpecialtyLabel(coach)} sessions at 971 MMA`
                  : 'Link your staff profile to show disciplines here.'}
              </Text>
            )}
          </Animated.View>

          <Animated.View style={credentialsEntrance}>
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

          <Animated.View style={[bottomEntrance, { gap: inset.md }]}>
            <ProfileAccountFooter
              versionLabel={versionLabel}
              onEditProfile={() => router.push('/edit-profile')}
              onSwitchToMemberMode={() => router.replace('/(tabs)')}
              onSignOut={handleSignOut}
              onChangePassword={() => router.push('/change-password')}
            />
          </Animated.View>
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}
