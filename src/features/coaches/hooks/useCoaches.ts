import { useQuery } from '@tanstack/react-query';
import { getCoaches, getCoachById, getClassesByCoachId } from '@/services/database';
import { getDirectoryProvider } from '@/services/integrations';
import {
  STATIC_DIRECTORY_GC_MS,
  STATIC_DIRECTORY_STALE_MS,
} from '@/lib/queryCachePolicy';

export const coachesKey = ['coaches'] as const;
export const coachesRefreshKey = ['coaches-refresh'] as const;

export function useCoaches() {
  return useQuery({
    queryKey: coachesKey,
    queryFn: getCoaches,
    staleTime: STATIC_DIRECTORY_STALE_MS,
    gcTime: STATIC_DIRECTORY_GC_MS,
  });
}

export function useCoachesRefresh() {
  const provider = getDirectoryProvider();

  return useQuery({
    queryKey: coachesRefreshKey,
    queryFn: () => provider.refreshCoaches(),
    staleTime: STATIC_DIRECTORY_STALE_MS,
    gcTime: STATIC_DIRECTORY_GC_MS,
  });
}

export async function forceCoachesRefresh() {
  const provider = getDirectoryProvider();
  return provider.refreshCoaches({ force: true });
}

export function coachKey(coachId: string) {
  return ['coach', coachId] as const;
}

export function coachClassesKey(coachId: string) {
  return ['coach-classes', coachId] as const;
}

export function useCoachDetail(coachId: string | undefined) {
  return useQuery({
    queryKey: coachKey(coachId ?? ''),
    queryFn: () => {
      if (!coachId) throw new Error('Coach id is required.');
      return getCoachById(coachId);
    },
    enabled: Boolean(coachId),
    staleTime: STATIC_DIRECTORY_STALE_MS,
  });
}

export function useCoachClasses(coachId: string | undefined) {
  return useQuery({
    queryKey: coachClassesKey(coachId ?? ''),
    queryFn: () => {
      if (!coachId) throw new Error('Coach id is required.');
      return getClassesByCoachId(coachId);
    },
    enabled: Boolean(coachId),
    staleTime: 5 * 60 * 1000,
  });
}
