import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClassDetailView } from '@/features/schedule/components/ClassDetailView';
import { useClassDetail } from '@/features/schedule/hooks/useSchedule';
import { findCoachIdForClass } from '@/features/schedule/utils/classDisplay';
import { useCoachDetail, useCoaches } from '@/features/coaches/hooks/useCoaches';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';

export default function ClassDetailScreen() {
  const { colors, inset } = useTheme();
  const router = useRouter();
  const { id, origin } = useLocalSearchParams<{ id: string; origin?: string }>();
  const classId = typeof id === 'string' ? id : undefined;
  const fromSchedule = origin === 'schedule';

  const classQuery = useClassDetail(classId);
  const item = classQuery.data;

  const coachesQuery = useCoaches();
  const coachId = useMemo(
    () => (item ? findCoachIdForClass(coachesQuery.data ?? [], item) : null),
    [coachesQuery.data, item],
  );
  const coachQuery = useCoachDetail(coachId ?? undefined);

  const openCoach = useCallback(() => {
    if (coachId) router.push(`/coaches/${coachId}?origin=coaches`);
  }, [coachId, router]);

  const backToSchedule = useCallback(() => {
    router.back();
  }, [router]);

  if (classQuery.isLoading) {
    return (
      <View style={[styles.stateWrap, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock kind="loading" title="Loading class" message="Fetching session details…" />
      </View>
    );
  }

  if (classQuery.error) {
    return (
      <View style={[styles.stateWrap, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="error"
          title="Could not load class"
          message={classQuery.error instanceof Error ? classQuery.error.message : 'Please try again.'}
          actionLabel="Retry"
          onAction={() => classQuery.refetch()}
        />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.stateWrap, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="empty"
          title="Class not found"
          message="This class may have been removed from the schedule."
          actionLabel="Back to schedule"
          onAction={() => router.replace('/(tabs)/schedule')}
        />
      </View>
    );
  }

  return (
    <ClassDetailView
      item={item}
      coach={coachQuery.data ?? null}
      coachLoading={Boolean(coachId) && coachQuery.isLoading}
      canOpenCoach={Boolean(coachId)}
      fromSchedule={fromSchedule}
      onOpenCoach={openCoach}
      onBackToSchedule={backToSchedule}
    />
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
