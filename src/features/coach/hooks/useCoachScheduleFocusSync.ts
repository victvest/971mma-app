import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateScheduleQueries,
  refreshScheduleMirror,
  forceScheduleRefresh,
} from '@/features/schedule/hooks/useSchedule';
import { forceCoachesRefresh } from '@/features/coaches/hooks/useCoaches';
import { getDirectoryProvider } from '@/services/integrations';
import { useCanRunMindbodyMirrorSync } from '@/features/auth/utils/canInvokeProtectedEdge';
import { isApiError } from '@/lib/apiError';
import { SCHEDULE_MIRROR_STALE_MS } from '@/lib/queryCachePolicy';
import { shouldInvalidateAfterMirrorSync } from '@/lib/queryRefresh';

/**
 * Keeps coach-facing class data fresh: links Mindbody staff IDs to academy coaches,
 * then mirrors today/tomorrow schedule from Mindbody.
 */
export function useCoachScheduleFocusSync(enabled = true) {
  const queryClient = useQueryClient();
  const canSync = useCanRunMindbodyMirrorSync();
  const mirrorEnabled = enabled && canSync;
  const lastSyncRef = useRef(0);
  const syncingRef = useRef(false);

  const sync = useCallback(
    async (force = false) => {
      if (!mirrorEnabled || syncingRef.current) return;

      const now = Date.now();
      const stale = now - lastSyncRef.current > SCHEDULE_MIRROR_STALE_MS;
      if (!force && !stale && lastSyncRef.current > 0) return;

      syncingRef.current = true;
      try {
        const staffResult = force
          ? await forceCoachesRefresh()
          : await getDirectoryProvider().refreshCoaches();
        const scheduleResult = force ? await forceScheduleRefresh() : await refreshScheduleMirror();

        lastSyncRef.current = Date.now();

        const shouldInvalidate =
          force ||
          shouldInvalidateAfterMirrorSync(staffResult) ||
          shouldInvalidateAfterMirrorSync(scheduleResult);

        if (shouldInvalidate) {
          await Promise.all([
            invalidateScheduleQueries(queryClient),
            queryClient.invalidateQueries({ queryKey: ['coaches'] }),
            queryClient.invalidateQueries({ queryKey: ['coach-classes'] }),
            queryClient.invalidateQueries({ queryKey: ['coach-dashboard'] }),
            queryClient.invalidateQueries({ queryKey: ['my-coach-classes'] }),
            queryClient.invalidateQueries({ queryKey: ['home-dashboard'] }),
          ]);
        }
      } catch (error) {
        if (__DEV__ && !(isApiError(error) && error.code === 'UNAUTHORIZED')) {
          console.warn('[coach] mirror sync failed', error);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [mirrorEnabled, queryClient],
  );

  useFocusEffect(
    useCallback(() => {
      void sync(false);
    }, [sync]),
  );

  return { sync };
}
