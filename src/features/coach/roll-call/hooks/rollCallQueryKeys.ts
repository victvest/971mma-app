import type { QueryClient } from '@tanstack/react-query';
import { COACH_LIVE_STALE_MS } from '@/lib/queryCachePolicy';

export const rollCallKey = (classId: string) => ['roll-call', classId] as const;
export const rollCallSessionKey = (classId: string) => ['roll-call-session', classId] as const;
export const rollCallSearchKey = (classId: string, query: string) =>
  ['roll-call-search', classId, query] as const;

const ROLL_CALL_INVALIDATION_DEBOUNCE_MS = 800;
const rollCallInvalidationTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function invalidateRollCallQueries(queryClient: QueryClient, classId: string) {
  void queryClient.invalidateQueries({ queryKey: rollCallKey(classId) });
  void queryClient.invalidateQueries({ queryKey: rollCallSessionKey(classId) });
}

export function flushRollCallInvalidation(queryClient: QueryClient, classId: string) {
  const pending = rollCallInvalidationTimers.get(classId);
  if (pending) {
    clearTimeout(pending);
    rollCallInvalidationTimers.delete(classId);
  }
  invalidateRollCallQueries(queryClient, classId);
}

/** Debounce full roll-call refetches during rapid deck marking; optimistic UI stays live. */
export function scheduleRollCallInvalidation(
  queryClient: QueryClient,
  classId: string,
  delayMs = ROLL_CALL_INVALIDATION_DEBOUNCE_MS,
) {
  const pending = rollCallInvalidationTimers.get(classId);
  if (pending) clearTimeout(pending);

  const timer = setTimeout(() => {
    rollCallInvalidationTimers.delete(classId);
    invalidateRollCallQueries(queryClient, classId);
  }, delayMs);

  rollCallInvalidationTimers.set(classId, timer);
}

export function prefetchRollCallState(
  queryClient: QueryClient,
  classId: string,
  queryFn: () => Promise<unknown>,
) {
  void queryClient.prefetchQuery({
    queryKey: rollCallKey(classId),
    queryFn,
    staleTime: COACH_LIVE_STALE_MS,
  });
}
