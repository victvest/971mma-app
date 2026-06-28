import React, { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallDeck } from '@/features/coach/roll-call/components/RollCallDeck';
import { useRollCallDeckMarking } from '@/features/coach/roll-call/hooks/useRollCallDeckMarking';
import { useRollCallSession } from '@/features/coach/roll-call/hooks/useRollCallSession';
import { DEFAULT_ROLL_CALL_CONFIG } from '@/features/coach/roll-call/types';
import {
  COACH_HOME_PATH,
  rollCallSummaryPath,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { useCoachClass } from '@/features/coach/hooks/useCoachMode';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfRouteMount } from '@/shared/performance';

export default function RollCallScreen() {
  const router = useRouter();
  usePerfRouteMount(PerfMark.routeRollCallMount);
  const { classId, review } = useLocalSearchParams<{ classId: string; review?: string }>();
  const resolvedClassId = classId ?? '';
  const isReviewFromSummary = review === '1';
  const { colors, inset } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { showConfirm, showAlert, showDialog, hideDialog } = useDialog();

  const classQuery = useCoachClass(resolvedClassId || null);
  const {
    rollCallQuery,
    deck,
    isCompleted,
    isStarting,
    unmarkedCount,
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

  const cardWidth = width;
  const cardHeight = useMemo(
    () => Math.max(360, height - insets.top - insets.bottom - 220),
    [height, insets.bottom, insets.top],
  );

  const isLoading =
    classQuery.isLoading || rollCallQuery.isLoading || (isStarting && deck.length === 0);

  const classTitle =
    classQuery.data?.title ?? rollCallQuery.data?.classTitle ?? 'Class roll call';
  const startsAt =
    classQuery.data?.startsAt ?? rollCallQuery.data?.startsAt ?? new Date().toISOString();
  const shouldOpenSummary =
    !isReviewFromSummary &&
    !isLoading &&
    !isCompleted &&
    deck.length > 0 &&
    unmarkedCount === 0;

  useEffect(() => {
    if (!shouldOpenSummary || !resolvedClassId) return;
    router.replace(rollCallSummaryPath(resolvedClassId));
  }, [resolvedClassId, router, shouldOpenSummary]);

  useFocusEffect(
    useCallback(() => {
      if (!isCompleted || !resolvedClassId) return;
      router.replace(COACH_HOME_PATH);
    }, [isCompleted, resolvedClassId, router]),
  );

  const handleDiscard = useCallback(async () => {
    try {
      await abandonSession();
      router.back();
    } catch (error) {
      showAlert(
        'Could not discard roll call',
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    }
  }, [abandonSession, router, showAlert]);

  const confirmExit = useCallback(() => {
    if (isAbandoning) return;

    if (isCompleted) {
      router.replace(COACH_HOME_PATH);
      return;
    }

    if (!hasProgress) {
      router.back();
      return;
    }

    showConfirm(
      'Leave roll call?',
      'Your progress is already saved.',
      () => {
        showDialog({
          title: 'Save your progress?',
          message: 'Save & resume later keeps your marks. Discard clears this roll call.',
          dismissOnBackdropPress: true,
          buttons: [
            {
              label: 'Save & resume later',
              variant: 'primary',
              onPress: () => {
                hideDialog();
                router.back();
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
    router,
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

  if (classQuery.isError && rollCallQuery.isError) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="error"
          title="Could not load roll call"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => {
            void classQuery.refetch();
            void rollCallQuery.refetch();
          }}
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
        startsAt={startsAt}
        members={deck}
        screenWidth={cardWidth}
        screenHeight={height}
        cardHeight={cardHeight}
        isLoading={isLoading}
        isRecording={isRecording || isAbandoning}
        reviewMode={isReviewFromSummary}
        onBackPress={confirmExit}
        onDeckComplete={() => {
          router.replace(rollCallSummaryPath(resolvedClassId));
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
