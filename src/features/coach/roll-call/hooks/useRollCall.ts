import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  abandonRollCall,
  completeRollCall,
  getRollCallState,
  recordRollCallMark,
  searchMembersForRollCall,
  startRollCall,
} from '@/services/database/rollCall.repository';
import type {
  RecordRollCallMarkInput,
  RecordRollCallMarkRequest,
  RollCallState,
} from '@/features/coach/roll-call/types';
import {
  applyOptimisticRollCallMark,
  findDeckMemberByInput,
  patchRollCallDeckMark,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import {
  buildQueuedMarkResponse,
  createClientGeneratedId,
} from '@/features/coach/roll-call/utils/rollCallOfflineQueue';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import { COACH_LIVE_STALE_MS } from '@/lib/queryCachePolicy';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  flushRollCallInvalidation,
  invalidateRollCallQueries,
  rollCallKey,
  rollCallSearchKey,
  rollCallSessionKey,
  scheduleRollCallInvalidation,
} from '@/features/coach/roll-call/hooks/rollCallQueryKeys';

export {
  flushRollCallInvalidation,
  invalidateRollCallQueries,
  prefetchRollCallState,
  rollCallKey,
  rollCallSearchKey,
  rollCallSessionKey,
  scheduleRollCallInvalidation,
} from '@/features/coach/roll-call/hooks/rollCallQueryKeys';

const ROLL_CALL_STALE_MS = COACH_LIVE_STALE_MS;
const SEARCH_DEBOUNCE_MS = 300;

function canUseCoachTools(role: string | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useRollCallState(classId: string | null) {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: rollCallKey(classId ?? 'none'),
    queryFn: () => getRollCallState(classId!),
    enabled: Boolean(classId) && canUseCoachTools(role),
    staleTime: ROLL_CALL_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

export function useStartRollCall(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!classId) throw new Error('Class id is required.');
      return startRollCall(classId);
    },
    onSuccess: () => {
      if (classId) {
        flushRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export type { RecordRollCallMarkInput } from '@/features/coach/roll-call/types';

export function useRecordRollCallMark(classId: string | null) {
  const queryClient = useQueryClient();
  const coachId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: async (input: RecordRollCallMarkInput) => {
      if (!classId) throw new Error('Class id is required.');

      const isOnline = getNetworkOnline();
      const clientGeneratedId = createClientGeneratedId();
      const metadata = {
        ...input.metadata,
        client_generated_id: clientGeneratedId,
      };

      if (!isOnline) {
        useRollCallOfflineQueueStore.getState().enqueue({
          clientGeneratedId,
          classId,
          mark: { ...input, metadata },
          enqueuedAt: new Date().toISOString(),
        });

        const cached = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
        return buildQueuedMarkResponse(
          { ...input, metadata },
          clientGeneratedId,
          coachId,
          cached?.session ?? null,
        );
      }

      const payload: RecordRollCallMarkRequest = {
        classId,
        userId: input.userId,
        mindbodyClientId: input.mindbodyClientId,
        status: input.status,
        method: input.method ?? 'roll_call',
        metadata,
      };
      return recordRollCallMark(payload);
    },
    onMutate: async (input) => {
      if (!classId) return undefined;

      await queryClient.cancelQueries({ queryKey: rollCallKey(classId) });
      const previous = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
      if (!previous) return { previous: undefined };

      const member = findDeckMemberByInput(previous.deck, input);
      const deckKey = member?.deckKey ?? input.userId ?? `mb:${input.mindbodyClientId}`;
      const next = applyOptimisticRollCallMark(previous, input, deckKey, coachId);
      queryClient.setQueryData(rollCallKey(classId), next);

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (classId && context?.previous) {
        queryClient.setQueryData(rollCallKey(classId), context.previous);
      }
    },
    onSuccess: (response, input) => {
      if (!classId) return;

      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;

        const member = findDeckMemberByInput(current.deck, input);
        const deckKey = member?.deckKey ?? input.userId ?? `mb:${input.mindbodyClientId}`;
        const withServerMark = patchRollCallDeckMark(current, deckKey, response.mark);

        return {
          ...withServerMark,
          session: response.session,
        };
      });
    },
    onSettled: () => {
      if (classId) {
        scheduleRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export function useCompleteRollCall(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => completeRollCall(sessionId),
    onSuccess: () => {
      if (classId) {
        flushRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export function useAbandonRollCall(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => abandonRollCall(sessionId),
    onSuccess: () => {
      if (classId) {
        flushRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export function useRollCallMemberSearch(classId: string | null, query: string) {
  const role = useAuthStore((s) => s.role);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: rollCallSearchKey(classId ?? 'none', debouncedQuery),
    queryFn: () => searchMembersForRollCall(classId!, debouncedQuery),
    enabled:
      Boolean(classId) &&
      canUseCoachTools(role) &&
      debouncedQuery.length >= 2,
    staleTime: ROLL_CALL_STALE_MS,
  });
}
