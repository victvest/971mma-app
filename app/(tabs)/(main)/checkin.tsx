import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppScrollView } from '@/shared/components/ui';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { refetchQueryGroup } from '@/lib/queryRefresh';
import { useTabEntranceReplay } from '@/shared/navigation/useTabEntranceReplay';
import { useBeltPath } from '@/features/belt/hooks/useBeltPath';
import { CheckInSectionHeader } from '@/features/checkin/components/CheckInSectionHeader';
import { CheckInEntranceSection } from '@/features/checkin/components/CheckInEntranceSection';
import { CheckInStatCards } from '@/features/checkin/components/CheckInStatCards';
import { RecentAttendanceSection } from '@/features/checkin/components/RecentAttendanceSection';
import type { CheckInMode } from '@/features/checkin/components/CheckInModeToggle';
import { buildBeltLine } from '@/features/checkin/utils/memberDisplay';
import {
  attendanceKey,
  attendanceRefreshKey,
  qrPassKey,
  useAttendance,
  useAttendanceRefresh,
  useCheckin,
  useQrPass,
} from '@/features/checkin/hooks/useCheckin';
import { useDisciplineScore } from '@/features/home/hooks/useHomeDashboard';
import { useRankEligibility } from '@/features/auth/hooks/useMemberDisciplines';
import { useMembership, membershipRefreshKey, useMembershipRefresh } from '@/features/profile/hooks/useMembership';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { isGymToday, GYM_TIME_ZONE } from '@/core/time/gymTime';
import {
  useActiveMemberId,
  useActiveProfileLabel,
  useGuardianCanShowChildQr,
  useIsViewingChildProfile,
} from '@/hooks/useActiveMemberId';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { triggerSuccessNotification, triggerLightImpact } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';

const AnimatedAppScrollView = Animated.createAnimatedComponent(AppScrollView);

type CheckInAnimatedSectionProps = {
  children: ReactNode;
  index: number;
  replayKey: number;
  motion?: 'default' | 'title' | 'qr' | 'content';
  style?: StyleProp<ViewStyle>;
};

function CheckInAnimatedSection({
  children,
  index,
  replayKey,
  motion = 'default',
  style,
}: CheckInAnimatedSectionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(42);

  useEffect(() => {
    const delay = Math.min(index, 7) * animations.stagger.base;
    opacity.value = 0;
    translateY.value = motion === 'qr' ? 52 : 42;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [index, motion, opacity, replayKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
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
  const [entranceMode, setEntranceMode] = useState<CheckInMode>('pass');
  const [simulating, setSimulating] = useState(false);
  const entranceReplayKey = useTabEntranceReplay();

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      return () => setTabFocused(false);
    }, []),
  );

  const qrPassEnabled = tabFocused && canShowChildQr && entranceMode === 'pass';
  const qrPassQuery = useQrPass(qrPassEnabled);
  const checkinMutation = useCheckin();
  const resetCheckinMutation = checkinMutation.reset;
  const attendanceRefresh = useAttendanceRefresh(tabFocused);
  const attendanceQuery = useAttendance();
  const profileQuery = useProfile();
  const beltPathQuery = useBeltPath();
  const rankEligibilityQuery = useRankEligibility();
  const disciplineQuery = useDisciplineScore();
  const membershipQuery = useMembership();
  useMembershipRefresh(tabFocused);

  useEffect(() => {
    if (attendanceRefresh.data?.refreshed) {
      void queryClient.invalidateQueries({ queryKey: attendanceKey(activeMemberId) });
    }
  }, [attendanceRefresh.data?.refreshed, queryClient, activeMemberId]);

  useEffect(() => {
    resetCheckinMutation();
  }, [activeMemberId, resetCheckinMutation]);

  const checkIns = useMemo(
    () => attendanceQuery.data?.pages.flat() ?? [],
    [attendanceQuery.data?.pages],
  );
  const checkedInToday = useMemo(
    () => checkIns.some((row) => isGymToday(row.checked_in_at)),
    [checkIns],
  );
  const todayCheckInAt = useMemo(
    () => checkIns.find((row) => isGymToday(row.checked_in_at))?.checked_in_at ?? null,
    [checkIns],
  );
  const canShowSelfCheckIn = __DEV__;
  const simulateDisabled = simulating || checkinMutation.isPending || checkedInToday;
  const totalHint = attendanceQuery.hasNextPage ? undefined : checkIns.length;

  const memberName = profileQuery.data?.fullName?.trim() || activeProfileLabel;
  const beltLine = useMemo(
    () =>
      rankEligibilityQuery.data?.eligible
        ? buildBeltLine(beltPathQuery.data, profileQuery.data ?? undefined)
        : 'Training identity',
    [beltPathQuery.data, profileQuery.data, rankEligibilityQuery.data?.eligible],
  );

  // Derive plan name and expiry for the digital card
  const planName = viewingChild ? null : (membershipQuery.data?.planName ?? null);
  const expiryDate = useMemo(() => {
    if (viewingChild) return null;
    const raw = membershipQuery.data?.expiresAt;
    if (!raw) return null;
    try {
      const date = new Date(raw);
      return `Expires ${new Intl.DateTimeFormat('en-GB', {
        timeZone: GYM_TIME_ZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)}`;
    } catch {
      return null;
    }
  }, [membershipQuery.data?.expiresAt, viewingChild]);

  const errorMessage =
    checkinMutation.error &&
    typeof checkinMutation.error === 'object' &&
    'message' in checkinMutation.error
      ? String((checkinMutation.error as { message: unknown }).message)
      : null;

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    try {
      await checkinMutation.mutateAsync({});
      triggerSuccessNotification();
      await queryClient.invalidateQueries({ queryKey: qrPassKey(activeMemberId) });
    } catch {
      // Mutation error is rendered from React Query state below.
    } finally {
      setSimulating(false);
    }
  }, [activeMemberId, checkinMutation, queryClient]);

  const onRefresh = useCallback(() => {
    triggerLightImpact();
    void qrPassQuery.refetch();
    void attendanceQuery.refetch();
    void beltPathQuery.refetch();
    void profileQuery.refetch();
    void disciplineQuery.refetch();
    void rankEligibilityQuery.refetch();
    void membershipQuery.refetch();
    void refetchQueryGroup(
      queryClient,
      [
        attendanceRefreshKey(activeMemberId),
        membershipRefreshKey(activeMemberId),
      ],
      { force: true },
    );
  }, [
    activeMemberId,
    attendanceQuery,
    beltPathQuery,
    disciplineQuery,
    membershipQuery,
    profileQuery,
    qrPassQuery,
    rankEligibilityQuery,
    queryClient,
  ]);

  const hasError =
    qrPassQuery.isError ||
    attendanceQuery.isError ||
    profileQuery.isError ||
    beltPathQuery.isError ||
    rankEligibilityQuery.isError ||
    disciplineQuery.isError ||
    membershipQuery.isError;

  const hasData =
    qrPassQuery.data !== undefined ||
    profileQuery.data !== undefined ||
    beltPathQuery.data !== undefined ||
    rankEligibilityQuery.data !== undefined ||
    disciplineQuery.data !== undefined ||
    membershipQuery.data !== undefined ||
    checkIns.length > 0;

  usePerfOnceReady(PerfMark.routeCheckinFirstContent, hasData);
  usePerfOnceReady(PerfMark.qrTokenVisible, qrPassEnabled && Boolean(qrPassQuery.data?.token), {
    memberId: activeMemberId,
  });

  const topInset = useAppTopInset();
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
      {hasError && !hasData ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: inset.lg }}>
          <StateBlock
            kind="error"
            title="Check-in unavailable"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={onRefresh}
          />
        </View>
      ) : (
        <AnimatedAppScrollView
          contentContainerStyle={screenPadding}
          showsVerticalScrollIndicator={false}
        >
          {hasError && hasData ? (
            <StateBlock
              kind="error"
              title="Check-in sync issue"
              message="Some information could not be updated."
              actionLabel="Retry"
              onAction={onRefresh}
            />
          ) : null}
          <CheckInAnimatedSection index={0} replayKey={entranceReplayKey} motion="title">
            <CheckInSectionHeader />
          </CheckInAnimatedSection>

          <CheckInAnimatedSection index={1} replayKey={entranceReplayKey} motion="qr">
            <CheckInEntranceSection
              tabFocused={tabFocused}
              checkedInToday={checkedInToday}
              checkedInAt={todayCheckInAt}
              token={qrPassQuery.data?.token}
              passLoading={
                qrPassEnabled &&
                !qrPassQuery.data?.token &&
                (qrPassQuery.isLoading || qrPassQuery.isFetching)
              }
              memberName={memberName}
              beltLine={beltLine}
              canShowActiveQr={canShowChildQr}
              planName={planName}
              expiryDate={expiryDate}
              onModeChange={setEntranceMode}
              showSimulate={canShowSelfCheckIn}
              simulating={simulating}
              simulateDisabled={simulateDisabled}
              onSimulate={handleSimulate}
            />
          </CheckInAnimatedSection>

          {errorMessage ? (
            <Text style={[styles.errorText, { color: colors.status.error }]}>{errorMessage}</Text>
          ) : null}

          <CheckInAnimatedSection index={2} replayKey={entranceReplayKey} motion="content">
            <CheckInStatCards
              score={disciplineQuery.data}
              membership={membershipQuery.data}
              scoreLoading={disciplineQuery.isLoading}
              membershipLoading={membershipQuery.isLoading}
              hideMembership={viewingChild}
            />
          </CheckInAnimatedSection>

          <CheckInAnimatedSection index={3} replayKey={entranceReplayKey} motion="content">
            <RecentAttendanceSection
              items={checkIns}
              loading={attendanceQuery.isLoading}
              syncing={attendanceRefresh.isFetching}
              totalHint={totalHint}
            />
          </CheckInAnimatedSection>

          <View style={{ height: inset['3xl'] + inset['2xl'] + inset.xl }} />
        </AnimatedAppScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  errorText: { fontSize: 13, lineHeight: 18 },
});
