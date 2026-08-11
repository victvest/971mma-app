import React, { useCallback, useMemo } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallDeck } from '@/features/coach/roll-call/components/RollCallDeck';
import { useRollCallDeckMarking } from '@/features/coach/roll-call/hooks/useRollCallDeckMarking';
import {
  useRemoveRollCallClassMember,
} from '@/features/coach/roll-call/hooks/useRollCall';
import { useRollCallSession } from '@/features/coach/roll-call/hooks/useRollCallSession';
import { DEFAULT_ROLL_CALL_CONFIG } from '@/features/coach/roll-call/types';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  exitCompletedRollCall,
  leaveRollCallDeck,
  openRollCallScanner,
  replaceWithRollCallSummary,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { buildRollCallSwipeQueue } from '@/features/coach/roll-call/utils/buildRollCallSwipeQueue';
import { useCoachClass } from '@/features/coach/hooks/useCoachMode';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage, USER_FACING_NETWORK_ERROR } from '@/lib/userFacingError';
import { PerfMark, usePerfRouteMount } from '@/shared/performance';

export default function RollCallScreen() {
  usePerfRouteMount(PerfMark.routeRollCallMount);
  const { classId, review } = useLocalSearchParams<{ classId: string; review?: string }>();
  const resolvedClassId = classId ?? '';
  const isReviewFromSummary = review === '1';
  const { colors, inset } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { showConfirm, showAlert, showDialog, hideDialog } = useDialog();
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const classQuery = useCoachClass(resolvedClassId || null);
  const {
    rollCallQuery,
    deck,
    isCompleted,
    isInProgress,
    isBootstrapping,
    hasProgress,
    isAbandoning,
    abandonSession,
  } = useRollCallSession(resolvedClassId || null);
  const {
    isRecording,
    recordWithStatus,
    revertMark,
    handleRecordError,
  } = useRollCallDeckMarking(
    resolvedClassId || null,
    rollCallQuery.data?.config ?? DEFAULT_ROLL_CALL_CONFIG,
  );
  const removeMemberMutation = useRemoveRollCallClassMember(resolvedClassId || null);

  const cardWidth = width;
  const cardHeight = useMemo(
    () => Math.max(360, height - insets.top - insets.bottom - 220),
    [height, insets.bottom, insets.top],
  );

  /**
   * Gate the deck until the first successful roster payload is ready and auto-start
   * has settled. Background refetches must not flip this — that caused the flash.
   */
  const isOfflineBlocked =
    networkStatusKnown &&
    !isOnline &&
    !isInProgress &&
    !isCompleted &&
    !isBootstrapping &&
    deck.length === 0;

  const classTitle =
    classQuery.data?.title ?? rollCallQuery.data?.classTitle ?? 'Class roll call';
  // Swipe queue excludes roster members without a facility check-in — they go to summary.
  // Never auto-jump while checked-in / walk-in / QR recognition cards remain.
  const swipeQueueCount = useMemo(() => buildRollCallSwipeQueue(deck).length, [deck]);
  const shouldOpenSummary =
    !isReviewFromSummary &&
    !isBootstrapping &&
    !isCompleted &&
    deck.length > 0 &&
    swipeQueueCount === 0;

  // Replace (not push) so Back never returns to a dead "all marked" deck screen.
  useFocusEffect(
    useCallback(() => {
      if (!shouldOpenSummary || !resolvedClassId) return;
      replaceWithRollCallSummary(resolvedClassId);
    }, [resolvedClassId, shouldOpenSummary]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isCompleted || !resolvedClassId) return;
      exitCompletedRollCall();
    }, [isCompleted, resolvedClassId]),
  );

  const handleDiscard = useCallback(async () => {
    try {
      await abandonSession();
      leaveRollCallDeck();
    } catch (error) {
      showAlert(
        'Could not discard roll call',
        toUserFacingErrorMessage(error, { fallback: USER_FACING_NETWORK_ERROR }),
      );
    }
  }, [abandonSession, showAlert]);

  const confirmExit = useCallback(() => {
    if (isAbandoning) return;

    if (isCompleted) {
      exitCompletedRollCall();
      return;
    }

    if (!hasProgress) {
      leaveRollCallDeck();
      return;
    }

    showConfirm(
      'Leave roll call?',
      'Your marks stay on this device until you confirm attendance.',
      () => {
        showDialog({
          title: 'Save your progress?',
          message: 'Save & resume later keeps your marks on this device. Discard clears this roll call.',
          dismissOnBackdropPress: true,
          buttons: [
            {
              label: 'Save & resume later',
              variant: 'primary',
              onPress: () => {
                hideDialog();
                leaveRollCallDeck();
              },
            },
            {
              label: 'Discard',
              variant: 'destructive',
              onPress: () => {
                hideDialog();
                void handleDiscard();
              },
            },
          ],
        });
      },
      { confirmLabel: 'Leave', cancelLabel: 'Stay' },
    );
  }, [
    handleDiscard,
    hasProgress,
    hideDialog,
    isAbandoning,
    isCompleted,
    showConfirm,
    showDialog,
  ]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmExit();
        return true;
      });
      return () => subscription.remove();
    }, [confirmExit]),
  );

  const openScanner = useCallback(() => {
    if (!resolvedClassId) return;
    openRollCallScanner(resolvedClassId, 'swiper');
  }, [resolvedClassId]);

  const handleRemoveMember = useCallback(
    async (member: RollCallDeckMember) => {
      if (!member.userId) {
        showAlert('Cannot remove', 'This member has no app account on the list.');
        return;
      }
      try {
        await removeMemberMutation.mutateAsync(member.userId);
      } catch (error) {
        showAlert(
          'Could not remove member',
          toUserFacingErrorMessage(error, { fallback: USER_FACING_NETWORK_ERROR }),
        );
        throw error;
      }
    },
    [removeMemberMutation, showAlert],
  );

  if (!resolvedClassId) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock kind="error" title="Missing class" message="Open roll call from a class first." />
      </View>
    );
  }

  if (isCompleted) {
    return null;
  }

  if (isOfflineBlocked) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="error"
          title="Connect to start roll call"
          message="Roll call needs internet to load the class list and begin. Marks made earlier will sync when you reconnect."
          actionLabel="Retry"
          onAction={() => {
            void classQuery.refetch();
            void rollCallQuery.refetch();
          }}
          offlineAwareRetry
        />
      </View>
    );
  }

  if (rollCallQuery.isError && !rollCallQuery.data) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="error"
          title="Could not load roll call"
          message={toUserFacingErrorMessage(rollCallQuery.error, {
            fallback: USER_FACING_NETWORK_ERROR,
          })}
          actionLabel="Retry"
          onAction={() => {
            void classQuery.refetch();
            void rollCallQuery.refetch();
          }}
          offlineAwareRetry
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.safe,
        {
          backgroundColor: colors.background.primary,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <RollCallDeck
        classId={resolvedClassId}
        classTitle={classTitle}
        members={deck}
        screenWidth={cardWidth}
        screenHeight={height}
        cardHeight={cardHeight}
        isLoading={isBootstrapping}
        isRecording={isRecording || isAbandoning}
        isRemovingMember={removeMemberMutation.isPending}
        reviewMode={isReviewFromSummary}
        onBackPress={confirmExit}
        onScanPress={openScanner}
        onRemoveMember={handleRemoveMember}
        onDeckComplete={() => {
          replaceWithRollCallSummary(resolvedClassId);
        }}
        onRecordMark={recordWithStatus}
        onRevertMark={revertMark}
        onRecordError={handleRecordError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
});
