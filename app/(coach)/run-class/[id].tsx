import React, { useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import {
  RunClassAttendanceHistoryButton,
  RunClassPrimaryButton,
  RunClassScanButton,
} from '@/features/coach/components/RunClassActionPanel';
import { RunClassMetaCard } from '@/features/coach/components/RunClassMetaCard';
import { CoachPostClassNotesSection } from '@/features/coach/components/notes/CoachPostClassNotesSection';
import { HomeAnimatedSection } from '@/features/home/components/HomeAnimatedSection';
import { AppBar, AppScrollView, NativeButton } from '@/shared/components/ui';
import {
  prefetchRollCallState,
  useRollCallState,
} from '@/features/coach/roll-call/hooks/useRollCall';
import { getRollCallState } from '@/services/database/rollCall.repository';
import {
  exitRunClassHub,
  openRollCallPrimary,
  openRollCallScanner,
  openRollCallSummary,
  rollCallPrimaryLabel,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { isRollCallSessionCompleted } from '@/features/coach/roll-call/utils/rollCallSession';
import { useCoachClass } from '@/features/coach/hooks/useCoachMode';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage, USER_FACING_LOAD_ERROR } from '@/lib/userFacingError';

/** Coach-only run-class screen — roll call is the primary attendance path. */
export default function CoachRunClassScreen() {
  const { colors, inset, gap } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const classQuery = useCoachClass(id ?? null);
  const rollCallQuery = useRollCallState(id ?? null);

  const rollCallSession = rollCallQuery.data?.session ?? null;
  const rollCallSummary = rollCallQuery.data?.summary;
  const isRollCallCompleted = isRollCallSessionCompleted(rollCallSession);

  const openRollCall = useCallback(() => {
    if (!id || isRollCallCompleted) return;
    const markedCount = rollCallSummary?.totalMarked ?? 0;
    const totalOnDeck = rollCallSummary?.totalOnDeck ?? 0;
    openRollCallPrimary(id, rollCallSession, markedCount, totalOnDeck);
  }, [id, isRollCallCompleted, rollCallSession, rollCallSummary]);

  const openAttendanceHistory = useCallback(() => {
    if (!id) return;
    openRollCallSummary(id);
  }, [id]);

  const openScanner = useCallback(() => {
    if (!id) return;
    prefetchRollCallState(queryClient, id, () => getRollCallState(id));
    openRollCallScanner(id, 'run_class');
  }, [id, queryClient]);

  const handleBackPress = useCallback(() => {
    exitRunClassHub({ forceHome: isRollCallCompleted });
  }, [isRollCallCompleted]);

  const rollCallActions = useMemo(() => {
    const markedCount = rollCallSummary?.totalMarked ?? 0;
    const totalOnDeck = rollCallSummary?.totalOnDeck ?? 0;

    return {
      rollCallButtonLabel: rollCallPrimaryLabel(rollCallSession, markedCount, totalOnDeck),
    };
  }, [rollCallSession, rollCallSummary]);

  if (classQuery.isLoading) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Run class" showBackButton />
        <View style={styles.body}>
          <View style={styles.centered}>
            <StateBlock kind="loading" title="Loading class" />
          </View>
        </View>
      </AppSafeAreaView>
    );
  }

  if (classQuery.error) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Run class" showBackButton />
        <View style={styles.body}>
          <View style={[styles.centered, { padding: inset.lg }]}>
            <StateBlock
              kind="error"
              title="Could not load class"
              message={toUserFacingErrorMessage(classQuery.error, {
                fallback: USER_FACING_LOAD_ERROR,
              })}
              actionLabel="Retry"
              onAction={() => classQuery.refetch()}
            />
          </View>
        </View>
      </AppSafeAreaView>
    );
  }

  const item = classQuery.data;
  if (!item) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Run class" showBackButton />
        <View style={styles.body}>
          <View style={[styles.centered, { padding: inset.lg, gap: gap.md }]}>
            <StateBlock
              kind="empty"
              title="Class not found"
              message="This class may have been removed or is no longer on your schedule."
              actionLabel="Back to classes"
              onAction={() => router.replace('/(coach)/(main)/classes')}
            />
            <NativeButton
              label="Retry load"
              variant="outline"
              onPress={() => classQuery.refetch()}
              full
            />
          </View>
        </View>
      </AppSafeAreaView>
    );
  }

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title="Run class" showBackButton onBackPress={handleBackPress} />

      <View style={styles.body}>
        <AppScrollView
          contentContainerStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: inset.lg,
            paddingBottom: inset['2xl'],
            gap: gap.md,
          }}
        >
          <HomeAnimatedSection index={0} motion="heroCard">
            <RunClassMetaCard classItem={item} />
          </HomeAnimatedSection>

          <HomeAnimatedSection index={1}>
            {isRollCallCompleted ? (
              <RunClassAttendanceHistoryButton onPress={openAttendanceHistory} />
            ) : (
              <RunClassPrimaryButton
                label={rollCallActions.rollCallButtonLabel}
                onPress={openRollCall}
              />
            )}
          </HomeAnimatedSection>

          <HomeAnimatedSection index={2}>
            <RunClassScanButton onPress={openScanner} />
          </HomeAnimatedSection>

          {isRollCallCompleted ? (
            <HomeAnimatedSection index={3}>
              <CoachPostClassNotesSection
                classId={item.id}
                disciplineId={item.disciplineId}
                members={rollCallQuery.data?.deck ?? []}
                enabled={isRollCallCompleted}
              />
            </HomeAnimatedSection>
          ) : null}
        </AppScrollView>
      </View>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
