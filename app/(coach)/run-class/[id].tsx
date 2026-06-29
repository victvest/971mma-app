import React, { useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  COACH_HOME_PATH,
  rollCallDeckPath,
  rollCallPrimaryLabel,
  rollCallSummaryPath,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { isRollCallSessionCompleted } from '@/features/coach/roll-call/utils/rollCallSession';
import { useCoachClass } from '@/features/coach/hooks/useCoachMode';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';

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
    router.push(rollCallDeckPath(id));
  }, [id, isRollCallCompleted, router]);

  const openAttendanceHistory = useCallback(() => {
    if (!id) return;
    router.push(rollCallSummaryPath(id));
  }, [id, router]);

  const openScanner = useCallback(() => {
    if (!id) return;
    prefetchRollCallState(queryClient, id, () => getRollCallState(id));
    router.push(`/(coach)/scanner?classId=${id}`);
  }, [id, queryClient, router]);

  const handleBackPress = useCallback(() => {
    if (isRollCallCompleted) {
      router.replace(COACH_HOME_PATH);
      return;
    }
    router.back();
  }, [isRollCallCompleted, router]);

  const rollCallActions = useMemo(() => {
    const markedCount = rollCallSummary?.totalMarked ?? 0;

    return {
      rollCallButtonLabel: rollCallPrimaryLabel(rollCallSession, markedCount),
    };
  }, [rollCallSession, rollCallSummary]);

  if (classQuery.isLoading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Run class" showBackButton />
        <View style={styles.body}>
          <View style={styles.centered}>
            <StateBlock kind="loading" title="Loading class" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (classQuery.error) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Run class" showBackButton />
        <View style={styles.body}>
          <View style={[styles.centered, { padding: inset.lg }]}>
            <StateBlock
              kind="error"
              title="Could not load class"
              message={
                classQuery.error instanceof Error
                  ? classQuery.error.message
                  : 'Please check your connection.'
              }
              actionLabel="Retry"
              onAction={() => classQuery.refetch()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const item = classQuery.data;
  if (!item) {
    return (
      <SafeAreaView
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
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
    </SafeAreaView>
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
