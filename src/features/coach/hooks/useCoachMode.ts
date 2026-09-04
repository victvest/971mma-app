import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import {
  fetchClassRoster,
  getCoachClassById,
  listPromotionCandidates,
  pickCurrentCoachClass,
} from '@/services/database/coach.repository';
import { getCoachDashboardSummary } from '@/services/database/coachDashboard.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ClassRosterResponse } from '@/types/domain';

export const coachDashboardKey = (coachId: string) => ['coach-dashboard', coachId] as const;
/** @deprecated Prefer coachDashboardKey — kept for invalidation compatibility. */
export const coachClassesKey = ['coach-classes'] as const;
export const coachClassKey = (classId: string) => ['coach-class', classId] as const;
export const coachRosterKey = (classId: string) => ['coach-roster', classId] as const;
/** @deprecated Prefer coachDashboardKey — kept for invalidation compatibility. */
export const coachStatsKey = ['coach-stats'] as const;
export const promotionCandidatesKey = ['promotion-candidates'] as const;

function canUseCoachTools(role: string | null | undefined): boolean {
  return role === 'coach';
}

function emptyClassRoster(classId = ''): ClassRosterResponse {
  return {
    classId,
    mindbodyClassId: '',
    title: '',
    startsAt: '',
    visitors: [],
    cached: true,
  };
}

function useCoachDashboardQuery() {
  const role = useAuthStore((s) => s.role);
  const { coach, isLoading: coachLoading, isError: coachError } = useMyCoachRecord();
  const hasRealCoachId = Boolean(coach?.id) && !String(coach?.id).startsWith('demo-');

  const query = useQuery({
    queryKey: coachDashboardKey(coach?.id ?? 'none'),
    queryFn: () => {
      if (!coach) {
        return {
          stats: {
            todayClassCount: 0,
            liveClassCount: 0,
            todayCheckIns: 0,
            promotionCandidateCount: 0,
          },
          classes: [],
        };
      }
      return getCoachDashboardSummary(coach);
    },
    // Wait for the linked coach row so we never hit get_coach_dashboard with DEMO_COACH's fake id.
    enabled: canUseCoachTools(role) && !coachLoading && (hasRealCoachId || Boolean(coach)),
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    isLoading: query.isLoading || coachLoading,
    isError: query.isError || coachError,
  };
}

export function useCoachClasses() {
  const dashboardQuery = useCoachDashboardQuery();

  return {
    ...dashboardQuery,
    data: dashboardQuery.data?.classes,
  };
}

export function useCoachClass(classId: string | null) {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: coachClassKey(classId ?? 'none'),
    queryFn: () => {
      if (!classId) return null;
      return getCoachClassById(classId);
    },
    enabled: Boolean(classId) && canUseCoachTools(role),
    staleTime: 60 * 1000,
  });
}

export function useCurrentCoachClass() {
  const classesQuery = useCoachClasses();
  const current = pickCurrentCoachClass(classesQuery.data ?? []);
  return { ...classesQuery, current };
}

export function useCoachDashboardStats() {
  const dashboardQuery = useCoachDashboardQuery();

  return {
    ...dashboardQuery,
    data: dashboardQuery.data?.stats,
  };
}

export function useClassRoster(classId: string | null) {
  const role = useAuthStore((s) => s.role);
  const resolvedClassId = classId && classId !== 'none' ? classId : null;

  return useQuery({
    queryKey: coachRosterKey(resolvedClassId ?? 'none'),
    queryFn: () => (resolvedClassId ? fetchClassRoster(resolvedClassId) : emptyClassRoster()),
    enabled: Boolean(resolvedClassId) && canUseCoachTools(role),
    staleTime: 30 * 1000,
  });
}

export function useRefreshClassRoster(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetchClassRoster(classId!, { force: true }),
    onSuccess: (data) => {
      if (classId) {
        queryClient.setQueryData(coachRosterKey(classId), data);
      }
    },
  });
}

export function usePromotionCandidates(
  discipline: 'bjj' | 'wrestling' | null,
  options: { enabled?: boolean } = {},
) {
  const role = useAuthStore((s) => s.role);
  const queryEnabled = (options.enabled ?? true) && canUseCoachTools(role) && discipline !== null;

  return useQuery({
    queryKey: [...promotionCandidatesKey, discipline ?? 'none'],
    queryFn: () => {
      if (!discipline) return [];
      return listPromotionCandidates(discipline);
    },
    enabled: queryEnabled,
    staleTime: 60 * 1000,
  });
}
