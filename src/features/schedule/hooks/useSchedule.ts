import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { gymDayKey, gymRangeIso, gymTodayTomorrowRange } from '@/core/time/gymTime';
import type { ScheduleCategory } from '@/features/schedule/utils/scheduleCategory';
import {
  filterScheduleByCategory,
  selectScheduleCategories,
} from '@/features/schedule/utils/scheduleDaySelectors';
import {
  fetchScheduleDayClasses,
  getClassById,
  getPrograms,
} from '@/services/database';
import { getScheduleProvider } from '@/services/integrations';
import {
  SCHEDULE_MIRROR_STALE_MS,
  SCHEDULE_PAGE_STALE_MS,
} from '@/lib/queryCachePolicy';
import { shouldInvalidateAfterMirrorSync } from '@/lib/queryRefresh';

const PAGE_SIZE = 20;

export { SCHEDULE_MIRROR_STALE_MS, SCHEDULE_PAGE_STALE_MS };

export { PAGE_SIZE as SCHEDULE_PAGE_SIZE };

export const programsKey = ['programs'] as const;

export function scheduleRefreshKey(range: { startDate: string; endDate: string }) {
  return ['schedule-refresh', range] as const;
}

export function scheduleDayKey(range: { fromISO: string; toISO: string }) {
  return ['schedule-day', range] as const;
}

export function schedulePagesKey(input: {
  fromISO: string;
  toISO: string;
  category: ScheduleCategory | null;
}) {
  return ['schedule', input] as const;
}

/** @deprecated Categories are derived from `scheduleDayKey`. Kept for invalidation compatibility. */
export function scheduleCategoriesKey(range: { fromISO: string; toISO: string }) {
  return ['schedule-categories', range] as const;
}

export async function ensureScheduleDay(
  queryClient: QueryClient,
  range: { fromISO: string; toISO: string },
): Promise<Awaited<ReturnType<typeof fetchScheduleDayClasses>>> {
  return queryClient.ensureQueryData({
    queryKey: scheduleDayKey(range),
    queryFn: () => fetchScheduleDayClasses(range.fromISO, range.toISO),
    staleTime: SCHEDULE_PAGE_STALE_MS,
  });
}

export async function invalidateScheduleQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: programsKey }),
    queryClient.invalidateQueries({ queryKey: ['schedule-day'] }),
    queryClient.invalidateQueries({ queryKey: ['schedule'] }),
    queryClient.invalidateQueries({ queryKey: ['schedule-categories'] }),
    queryClient.invalidateQueries({ queryKey: ['schedule-refresh'] }),
  ]);
}

export function usePrograms() {
  return useQuery({
    queryKey: programsKey,
    queryFn: getPrograms,
    staleTime: SCHEDULE_PAGE_STALE_MS,
  });
}

type ScheduleMirrorResult = {
  refreshed: boolean;
  programs: { refreshed: boolean; count?: number };
  schedule: { refreshed: boolean; count?: number };
};

async function runScheduleMirrorSync(
  range: { startDate: string; endDate: string },
  force = false,
): Promise<ScheduleMirrorResult> {
  const provider = getScheduleProvider();
  const programs = await provider.refreshPrograms();
  const schedule = await provider.refreshSchedule(force ? { ...range, force: true } : range);
  return {
    refreshed: programs.refreshed || schedule.refreshed,
    programs,
    schedule,
  };
}

export function useScheduleRefresh(range = gymTodayTomorrowRange()) {
  const role = useAuthStore((s) => s.role);
  const isGuest = role === 'guest';

  return useQuery({
    queryKey: scheduleRefreshKey(range),
    queryFn: () => runScheduleMirrorSync(range),
    enabled: !isGuest,
    staleTime: SCHEDULE_MIRROR_STALE_MS,
  });
}

export async function forceScheduleRefresh(range = gymTodayTomorrowRange()) {
  return runScheduleMirrorSync(range, true);
}

export async function refreshScheduleMirror(range = gymTodayTomorrowRange()) {
  return runScheduleMirrorSync(range, false);
}

export function useScheduleDay(range = gymRangeIso()) {
  return useQuery({
    queryKey: scheduleDayKey(range),
    queryFn: () => fetchScheduleDayClasses(range.fromISO, range.toISO),
    staleTime: SCHEDULE_PAGE_STALE_MS,
  });
}

/**
 * Re-sync Mindbody → Supabase when the member returns to a tab that shows classes.
 * Skips work when the mirror is still fresh and does not invalidate cached rows.
 */
export function useScheduleFocusSync(enabled = true) {
  const queryClient = useQueryClient();
  const lastSyncRef = useRef(0);
  const lastDayKeyRef = useRef(gymDayKey());
  const syncingRef = useRef(false);

  const role = useAuthStore((s) => s.role);
  const isGuest = role === 'guest';
  const actualEnabled = enabled && !isGuest;

  const sync = useCallback(
    async (force = false) => {
      if (!actualEnabled || syncingRef.current) return;

      const now = Date.now();
      const currentDayKey = gymDayKey();
      const dayChanged = currentDayKey !== lastDayKeyRef.current;
      const stale = now - lastSyncRef.current > SCHEDULE_MIRROR_STALE_MS;
      if (!force && !dayChanged && !stale && lastSyncRef.current > 0) {
        return;
      }

      syncingRef.current = true;
      try {
        const result = force
          ? await forceScheduleRefresh()
          : await refreshScheduleMirror();
        lastSyncRef.current = Date.now();
        lastDayKeyRef.current = currentDayKey;
        if (shouldInvalidateAfterMirrorSync(result, force)) {
          await invalidateScheduleQueries(queryClient);
          await queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [actualEnabled, queryClient],
  );

  useFocusEffect(
    useCallback(() => {
      void sync(false);
    }, [sync]),
  );

  return { sync };
}

/** After the mirror sync query settles, reload list rows only when the mirror refreshed. */
export function useScheduleMirrorInvalidation(
  mirrorResult: ScheduleMirrorResult | undefined,
  dataUpdatedAt: number,
  isSuccess: boolean,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSuccess || dataUpdatedAt === 0) return;
    if (!shouldInvalidateAfterMirrorSync(mirrorResult)) return;
    void invalidateScheduleQueries(queryClient);
  }, [dataUpdatedAt, isSuccess, mirrorResult, queryClient]);
}

export function useScheduleCategories() {
  const range = gymRangeIso();

  return useQuery({
    queryKey: scheduleDayKey(range),
    queryFn: () => fetchScheduleDayClasses(range.fromISO, range.toISO),
    staleTime: SCHEDULE_PAGE_STALE_MS,
    select: selectScheduleCategories,
  });
}

export function useSchedulePages(category: ScheduleCategory | null) {
  const range = gymRangeIso();
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: schedulePagesKey({ ...range, category }),
    queryFn: async ({ pageParam }) => {
      const day = await ensureScheduleDay(queryClient, range);
      return filterScheduleByCategory(day, category).slice(
        pageParam,
        pageParam + PAGE_SIZE,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPageParam + PAGE_SIZE,
    staleTime: SCHEDULE_PAGE_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function classKey(classId: string) {
  return ['class', classId] as const;
}

export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: classKey(classId ?? ''),
    queryFn: () => {
      if (!classId) throw new Error('Class id is required.');
      return getClassById(classId);
    },
    enabled: Boolean(classId),
    staleTime: SCHEDULE_PAGE_STALE_MS,
  });
}
