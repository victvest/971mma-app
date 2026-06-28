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

export const myCoachClassesKey = ['my-coach-classes'] as const;

export function useMyCoachRecord() {
  const profileQuery = useProfile();
  const coachesQuery = useCoaches();

  const coach = useMemo(() => {
    const matched = findCoachForProfile(coachesQuery.data ?? [], profileQuery.data?.fullName);
    if (isCoachDemoMode()) {
      return matched ?? DEMO_COACH;
    }
    return matched;
  }, [coachesQuery.data, profileQuery.data?.fullName]);

  return {
    coach,
    profileQuery,
    coachesQuery,
    isLoading: profileQuery.isLoading || coachesQuery.isLoading,
    isError: profileQuery.isError || coachesQuery.isError,
  };
}

export function useMyCoachClasses(coach: ReturnType<typeof findCoachForProfile>) {
  return useQuery({
    queryKey: [...myCoachClassesKey, coach?.id ?? 'none'],
    queryFn: () => getClassesByCoach(coach!),
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
