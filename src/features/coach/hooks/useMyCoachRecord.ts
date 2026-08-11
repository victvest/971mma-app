import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEMO_COACH } from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';
import { getCoachDisciplineTags } from '@/features/coaches/components/CoachVisuals';
import {
  collectCoachDisciplines,
  findCoachForProfile,
} from '@/features/coach/utils/findCoachForProfile';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { getClassesByCoach } from '@/services/database/classes.repository';
import { getCoachByUserId } from '@/services/database/coaches.repository';

export const myCoachClassesKey = ['my-coach-classes'] as const;
export const myCoachRecordKey = (userId: string) => ['my-coach-record', userId] as const;

export function useMyCoachRecord() {
  const profileQuery = useProfile();
  const coachesQuery = useCoaches();
  const userId = profileQuery.data?.id;

  const linkedCoachQuery = useQuery({
    queryKey: myCoachRecordKey(userId ?? 'none'),
    queryFn: () => getCoachByUserId(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const coach = useMemo(() => {
    if (linkedCoachQuery.data) return linkedCoachQuery.data;

    const matched = findCoachForProfile(
      coachesQuery.data ?? [],
      profileQuery.data?.fullName,
      userId,
    );
    if (matched) return matched;

    // Only use the fixture coach in explicit demo mode. Falling back to DEMO_COACH
    // in production caused dashboard RPCs to run with id "demo-coach-profile".
    if (isCoachDemoMode()) {
      return DEMO_COACH;
    }

    return null;
  }, [coachesQuery.data, linkedCoachQuery.data, profileQuery.data?.fullName, userId]);

  const isLoadingCoachRecord =
    Boolean(userId) &&
    (linkedCoachQuery.isLoading || linkedCoachQuery.isFetching) &&
    !linkedCoachQuery.data;

  return {
    coach,
    profileQuery,
    coachesQuery,
    linkedCoachQuery,
    isLoading:
      profileQuery.isLoading ||
      coachesQuery.isLoading ||
      linkedCoachQuery.isLoading ||
      isLoadingCoachRecord,
    isError: profileQuery.isError || coachesQuery.isError || linkedCoachQuery.isError,
  };
}

export function useMyCoachClasses(coach: ReturnType<typeof findCoachForProfile>) {
  return useQuery({
    queryKey: [...myCoachClassesKey, coach?.id ?? 'none'],
    queryFn: () => {
      if (!coach) return [];
      return getClassesByCoach(coach);
    },
    enabled: Boolean(coach),
    staleTime: 60 * 1000,
  });
}

export function useMyCoachDisciplines(
  coach: ReturnType<typeof findCoachForProfile>,
  classes: ReturnType<typeof useMyCoachClasses>['data'],
) {
  return useMemo(() => {
    const tags = coach ? getCoachDisciplineTags(coach) : [];
    return collectCoachDisciplines(coach, classes ?? [], tags);
  }, [classes, coach]);
}
