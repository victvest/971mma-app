import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAccountActionSheet } from '@/shared/hooks/useAccountActionSheet';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { AppScrollView } from '@/shared/components/ui';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { refetchQueryGroup } from '@/lib/queryRefresh';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { CheckInSectionHeader } from '@/features/checkin/components/CheckInSectionHeader';
import { CheckInEntranceSection } from '@/features/checkin/components/CheckInEntranceSection';
import { CheckInStatCards } from '@/features/checkin/components/CheckInStatCards';
import { RecentAttendanceSection } from '@/features/checkin/components/RecentAttendanceSection';
import { formatMembershipExpiry } from '@/features/checkin/utils/memberDisplay';
import { formatAttendanceSubtitle } from '@/features/checkin/utils/formatAttendance';
import {
  attendanceKey,
  attendanceRefreshKey,
  useAttendance,
  useAttendanceRefresh,
  useQrPass,
} from '@/features/checkin/hooks/useCheckin';
import { useDisciplineScore } from '@/features/home/hooks/useHomeDashboard';
import {
  useMembership,
  membershipKey,
  useMembershipRefresh,
  syncMembershipFromMindbody,
} from '@/features/profile/hooks/useMembership';
import { profileKey } from '@/features/profile/hooks/useProfile';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { findLatestFacilityArrivalToday, findTodaysArrival } from '@/features/attendance/utils/classifyCheckIn';
import type { MembershipSummary } from '@/types/domain';
import {
  useActiveMemberId,
  useActiveProfileLabel,
  useGuardianCanShowChildQr,
  useIsViewingChildProfile,
} from '@/hooks/useActiveMemberId';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { isOfflineWithoutCache, OFFLINE_MESSAGE, OFFLINE_TITLE } from '@/lib/offlineState';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';

const AnimatedAppScrollView = Animated.createAnimatedComponent(AppScrollView);

type CheckInAnimatedSectionProps = {
  children: ReactNode;
  index: number;
  entranceSignal: SharedValue<number>;
  motion?: 'default' | 'title' | 'qr' | 'content';
  style?: StyleProp<ViewStyle>;
};

function CheckInAnimatedSection({
  children,
  index,
  entranceSignal,
  motion = 'default',
  style,
}: CheckInAnimatedSectionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(42);

  const runAnimation = useCallback(() => {
    'worklet';
    const delay = Math.min(index, 7) * animations.stagger.base;
    opacity.value = 0;
    translateY.value = motion === 'qr' ? 52 : 42;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [index, motion, opacity, translateY]);

  useEffect(() => {
    runAnimation();
  }, [runAnimation]);

  useAnimatedReaction(
    () => entranceSignal.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runAnimation();
      }
    },
    [entranceSignal, runAnimation],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type ChildCheckInStatusCardProps = {
  checkedInToday: boolean;
  checkedInAt: string | null;
  memberName: string;
  membership: MembershipSummary | undefined;
  expiryDate: string | null;
  membershipLoading: boolean;
};

function ChildCheckInStatusCard({
  checkedInToday,
  checkedInAt,
  memberName,
  membership,
  expiryDate,
  membershipLoading,
}: ChildCheckInStatusCardProps) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();

  if (checkedInToday) {
    const timeLabel = checkedInAt ? formatAttendanceSubtitle(checkedInAt) : null;
    const title = 'Arrived today';
    const message = timeLabel
      ? `${memberName} checked in at ${timeLabel}.`
      : `${memberName} has checked in today.`;

    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={message}
        style={[
          styles.childStatusCard,
          {
            backgroundColor: colors.surface.primary,
            borderColor: colors.accent.default,
            borderRadius: radius.cardLarge,
            borderWidth: layout.borderWidth + 0.5,
            gap: gap.md,
            padding: inset.lg,
          },
        ]}
      >
        <View
          style={[
            styles.childStatusIcon,
            {
              backgroundColor: colors.accent.subtle,
              borderRadius: radius.pill,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={26} color={colors.accent.default} />
        </View>
        <View style={{ gap: gap.xs }}>
          <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {message}
          </Text>
        </View>
      </View>
    );
  }

  // Not checked in today - show membership information
  const status = membership?.status ?? 'none';
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isExpired = status === 'expired';

  let title = 'No active membership';
  if (isActive && membership?.planName) {
    title = membership.planName;
  } else if (isPaused) {
    title = 'Membership paused';
  } else if (isExpired && membership?.planName) {
    title = `${membership.planName} (Expired)`;
  }

  let statusText = 'Inactive';
  let statusColor = colors.status.error;
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle-outline';
  let iconBg = colors.status.errorSubtle;

  if (isActive) {
    statusText = 'Active';
    statusColor = colors.accent.default;
    iconName = 'checkmark-circle';
    iconBg = colors.accent.subtle;
  } else if (isPaused) {
    statusText = 'Paused';
    statusColor = colors.status.warning;
    iconName = 'pause-circle-outline';
    iconBg = colors.status.warningSubtle;
  }

  const expiryText = expiryDate ? `Expires ${expiryDate}` : 'No expiration date';
  const displayTitle = membershipLoading ? 'Loading membership...' : title;
  const displaySubtitle = membershipLoading
    ? 'Checking active status...'
    : `Status: ${statusText} • ${expiryText}`;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${displayTitle}. ${displaySubtitle}`}
      style={[
        styles.childStatusCard,
        {
          backgroundColor: colors.surface.primary,
          borderColor: isActive ? colors.accent.default : colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          gap: gap.md,
          padding: inset.lg,
        },
      ]}
    >
      <View
        style={[
          styles.childStatusIcon,
          {
            backgroundColor: iconBg,
            borderRadius: radius.pill,
          },
        ]}
      >
        <Ionicons name={iconName} size={26} color={statusColor} />
      </View>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
          {displayTitle}
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          {displaySubtitle}
        </Text>
      </View>
    </View>
  );
}

export default function CheckInScreen() {
  const { colors, inset, layout, gap } = useTheme();
  usePerfRouteMount(PerfMark.routeCheckinMount);
  const { contentBottomInset } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const activeMemberId = useActiveMemberId();
  const activeProfileLabel = useActiveProfileLabel();
  const canShowChildQr = useGuardianCanShowChildQr();
  const viewingChild = useIsViewingChildProfile();

  const [tabFocused, setTabFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { entranceSignal } = useTabEntrance();

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      return () => setTabFocused(false);
    }, []),
  );

  const { hasLimitedAccess } = useIsGuest();
  const userStore = useAuthStore((s) => s.user);
  const { prompt, sheet } = useAccountActionSheet();

  const showQrPass = !viewingChild || canShowChildQr;
  const qrPassEnabled = tabFocused && showQrPass && canShowChildQr && !hasLimitedAccess;
  const qrPassQuery = useQrPass(qrPassEnabled);
  const attendanceRefresh = useAttendanceRefresh(tabFocused);
  const attendanceQuery = useAttendance();
  const profileQuery = useProfile();
  const disciplineQuery = useDisciplineScore();
  const membershipQuery = useMembership();
  const membershipRefresh = useMembershipRefresh(tabFocused);
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  useEffect(() => {
    if (membershipRefresh.data?.refreshed) {
      void queryClient.invalidateQueries({ queryKey: membershipKey(activeMemberId) });
      void queryClient.invalidateQueries({ queryKey: profileKey(activeMemberId) });
    }
  }, [membershipRefresh.data?.refreshed, queryClient, activeMemberId]);

  useEffect(() => {
    if (attendanceRefresh.data?.refreshed) {
      void queryClient.invalidateQueries({ queryKey: attendanceKey(activeMemberId) });
    }
  }, [attendanceRefresh.data?.refreshed, queryClient, activeMemberId]);

  const checkIns = useMemo(
    () => attendanceQuery.data?.pages.flat() ?? [],
    [attendanceQuery.data?.pages],
  );

  const topInset = useAppTopInset();

  const memberName = profileQuery.data?.fullName?.trim() || activeProfileLabel;

  const expiryDate = useMemo(() => {
    if (hasLimitedAccess) return null;
    const raw =
      membershipQuery.data?.expiresAt ??
      profileQuery.data?.membershipExpiresAt ??
      membershipRefresh.data?.summary?.expiresAt ??
      null;
    return formatMembershipExpiry(raw);
  }, [
    membershipQuery.data?.expiresAt,
    membershipRefresh.data?.summary?.expiresAt,
    profileQuery.data?.membershipExpiresAt,
    hasLimitedAccess,
  ]);

  const todaysArrival = useMemo(
    () => (hasLimitedAccess ? undefined : findTodaysArrival(checkIns)),
    [checkIns, hasLimitedAccess],
  );
  const latestFacilityArrival = useMemo(
    () => (hasLimitedAccess ? undefined : findLatestFacilityArrivalToday(checkIns)),
    [checkIns, hasLimitedAccess],
  );
  const checkedInToday = Boolean(todaysArrival);
  const todayCheckInAt =
    latestFacilityArrival?.checked_in_at ?? todaysArrival?.checked_in_at ?? null;
  const totalHint = attendanceQuery.hasNextPage ? undefined : checkIns.length;

  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  const onRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      // Sync Mindbody first, then refetch UI so membership status is not stale.
      await syncMembershipFromMindbody(queryClient, { activeMemberId, authUserId });
      await Promise.all([
        qrPassQuery.refetch(),
        attendanceQuery.refetch(),
        profileQuery.refetch(),
        disciplineQuery.refetch(),
        membershipQuery.refetch(),
        refetchQueryGroup(queryClient, [attendanceRefreshKey(activeMemberId)], { force: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    activeMemberId,
    attendanceQuery,
    authUserId,
    disciplineQuery,
    membershipQuery,
    profileQuery,
    qrPassQuery,
    queryClient,
  ]);

  const hasError =
    !hasLimitedAccess &&
    (qrPassQuery.isError ||
      attendanceQuery.isError ||
      profileQuery.isError ||
      disciplineQuery.isError ||
      membershipQuery.isError);

  const hasData =
    hasLimitedAccess ||
    qrPassQuery.data !== undefined ||
    profileQuery.data !== undefined ||
    disciplineQuery.data !== undefined ||
    membershipQuery.data !== undefined ||
    checkIns.length > 0;

  const isOfflineBlocked =
    !hasLimitedAccess &&
    isOfflineWithoutCache({
      networkStatusKnown,
      isOnline,
      hasData,
      hasError,
    });

  usePerfOnceReady(PerfMark.routeCheckinFirstContent, hasData);
  usePerfOnceReady(PerfMark.qrTokenVisible, qrPassEnabled && Boolean(qrPassQuery.data?.token), {
    memberId: activeMemberId,
  });

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;

  const screenPadding = {
    paddingHorizontal: inset.lg,
    paddingTop: screenPaddingTop,
    paddingBottom: contentBottomInset + 120,
    gap: gap.lg,
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      {isOfflineBlocked ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: inset.lg }}>
          <StateBlock
            kind="error"
            title={OFFLINE_TITLE}
            message={OFFLINE_MESSAGE}
            actionLabel="Retry"
            onAction={onRefresh}
            offlineAwareRetry
          />
        </View>
      ) : hasError && !hasData ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: inset.lg }}>
          <StateBlock
            kind="error"
            title="Check-in unavailable"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={onRefresh}
            offlineAwareRetry
          />
        </View>
      ) : (
        <AnimatedAppScrollView
          contentContainerStyle={screenPadding}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressViewOffset={headerBottom}
              tintColor={colors.accent.default}
            />
          }
        >
          {hasError && hasData ? (
            <StateBlock
              kind="error"
              title="Check-in sync issue"
              message="Some information could not be updated."
              actionLabel="Retry"
              onAction={onRefresh}
              offlineAwareRetry
            />
          ) : null}
          <CheckInAnimatedSection index={0} entranceSignal={entranceSignal} motion="title">
            <CheckInSectionHeader mode={showQrPass ? 'member-card' : 'child-status'} />
          </CheckInAnimatedSection>

          <CheckInAnimatedSection index={1} entranceSignal={entranceSignal} motion="qr">
            {showQrPass ? (
              <CheckInEntranceSection
                tabFocused={tabFocused}
                checkedInToday={checkedInToday}
                checkedInAt={todayCheckInAt}
                token={hasLimitedAccess ? null : qrPassQuery.data?.token}
                expiresAt={hasLimitedAccess ? null : qrPassQuery.data?.expiresAt}
                memberId={hasLimitedAccess ? null : activeMemberId}
                passLoading={
                  !hasLimitedAccess &&
                  qrPassEnabled &&
                  !qrPassQuery.data?.token &&
                  (qrPassQuery.isLoading || qrPassQuery.isFetching)
                }
                memberName={memberName}
                canShowActiveQr={hasLimitedAccess ? true : canShowChildQr}
                expiryDate={expiryDate}
                expiryLoading={
                  !hasLimitedAccess &&
                  !viewingChild &&
                  !expiryDate &&
                  (membershipQuery.isLoading ||
                    membershipQuery.isFetching ||
                    membershipRefresh.isLoading ||
                    membershipRefresh.isFetching)
                }
                isGuest={hasLimitedAccess}
                requiresAccount={hasLimitedAccess}
                isRegistered={userStore !== null}
                onRequireAccount={() => prompt('check-in')}
              />
            ) : (
              <ChildCheckInStatusCard
                checkedInToday={checkedInToday}
                checkedInAt={todayCheckInAt}
                memberName={memberName}
                membership={membershipQuery.data}
                expiryDate={expiryDate}
                membershipLoading={membershipQuery.isLoading}
              />
            )}
          </CheckInAnimatedSection>

          {!hasLimitedAccess ? (
            <CheckInAnimatedSection index={2} entranceSignal={entranceSignal} motion="content">
              <CheckInStatCards
                score={disciplineQuery.data}
                membership={membershipQuery.data}
                scoreLoading={disciplineQuery.isLoading}
                membershipLoading={
                  membershipQuery.isLoading ||
                  membershipQuery.isFetching ||
                  membershipRefresh.isFetching
                }
                hideMembership={viewingChild}
              />
            </CheckInAnimatedSection>
          ) : null}

          {!hasLimitedAccess ? (
            <CheckInAnimatedSection index={3} entranceSignal={entranceSignal} motion="content">
              <RecentAttendanceSection
                items={checkIns}
                loading={attendanceQuery.isLoading}
                syncing={attendanceRefresh.isFetching}
                totalHint={totalHint}
              />
            </CheckInAnimatedSection>
          ) : null}

          <View style={{ height: inset['3xl'] + inset['2xl'] + inset.xl }} />
        </AnimatedAppScrollView>
      )}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  childStatusCard: {
    overflow: 'hidden',
  },
  childStatusIcon: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
