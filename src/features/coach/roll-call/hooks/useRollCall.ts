import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  abandonRollCall,
  addRollCallClassMember,
  completeRollCall,
  getRollCallState,
  recordRollCallMark,
  removeRollCallClassMember,
  searchMembersForRollCall,
  startRollCall,
} from '@/services/database/rollCall.repository';
import type {
  RecordRollCallMarkInput,
  RecordRollCallMarkRequest,
  RollCallMemberPreview,
  RollCallState,
} from '@/features/coach/roll-call/types';
import { DEFAULT_ROLL_CALL_CONFIG } from '@/features/coach/roll-call/types';
import { isRollCallSessionInProgress } from '@/features/coach/roll-call/utils/rollCallSession';
import {
  applyOptimisticRollCallMark,
  findDeckMemberByInput,
  patchRollCallDeckMark,
  preserveUnsyncedDeckMarks,
  upsertOptimisticRosterMember,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import { resolveRollCallSummary } from '@/features/coach/roll-call/utils/resolveRollCallSummary';
import { clearLocalTempRollCallClass } from '@/features/coach/roll-call/fixtures/rollCallLocalTempSeed';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';
import {
  buildQueuedMarkResponse,
  createClientGeneratedId,
} from '@/features/coach/roll-call/utils/rollCallOfflineQueue';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import { COACH_LIVE_STALE_MS } from '@/lib/queryCachePolicy';
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
  const resolvedClassId = classId && classId !== 'none' ? classId : null;
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: rollCallKey(resolvedClassId ?? 'none'),
    queryFn: async () => {
      if (!resolvedClassId) {
        return {
          session: null,
          classId: '',
          classTitle: '',
          startsAt: '',
          deck: [],
          summary: {
            present: 0,
            late: 0,
            absent: 0,
            leftEarly: 0,
            walkIns: 0,
            guests: 0,
            notOnApp: 0,
            sessionCount: 0,
            totalMarked: 0,
            totalOnDeck: 0,
          },
          rosterCachedAt: null,
          config: DEFAULT_ROLL_CALL_CONFIG,
          rosterAttendance: { checkedIn: 0, missing: 0 },
        } satisfies RollCallState;
      }

      const fresh = await getRollCallState(resolvedClassId);
      const cached = queryClient.getQueryData<RollCallState>(rollCallKey(resolvedClassId));
      return preserveUnsyncedDeckMarks(cached, fresh);
    },
    enabled: Boolean(resolvedClassId) && canUseCoachTools(role),
    staleTime: ROLL_CALL_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useStartRollCall(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!classId) throw new Error('Class id is required.');
      return startRollCall(classId);
    },
    onSuccess: (data) => {
      if (!classId) return;
      // Patch session immediately so auto-start cannot race refetch and re-fire.
      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;
        return { ...current, session: data.session };
      });
      scheduleRollCallInvalidation(queryClient, classId);
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
      // Do not invalidate here — refetches mid-deck reorder the stack and flash the UI.
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
      if (!classId) return;

      // Wipe local TEMP marks + unsynced cache marks so Discard is real.
      clearLocalTempRollCallClass(classId);
      useRollCallOfflineQueueStore.getState().clearForClass(classId);
      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;
        const deck = current.deck.map((member) => ({ ...member, mark: null }));
        return {
          ...current,
          session: null,
          deck,
          summary: resolveRollCallSummary({ deck, config: current.config }),
        };
      });
      flushRollCallInvalidation(queryClient, classId);
    },
  });
}

export function useRollCallMemberSearch(classId: string | null, query: string) {
  const role = useAuthStore((s) => s.role);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: rollCallSearchKey(classId ?? 'none', debouncedQuery),
    queryFn: () => searchMembersForRollCall(classId!, debouncedQuery),
    enabled: Boolean(classId) && canUseCoachTools(role) && debouncedQuery.length >= 2,
    staleTime: ROLL_CALL_STALE_MS,
  });
}

export function useAddRollCallClassMember(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { userId: string; preview?: Partial<RollCallMemberPreview> }) => {
      if (!classId) throw new Error('Class id is required.');
      return addRollCallClassMember(classId, input.userId, input.preview);
    },
    onSuccess: () => {
      if (classId) {
        flushRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export function useRemoveRollCallClassMember(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => {
      if (!classId) throw new Error('Class id is required.');
      return removeRollCallClassMember(classId, userId);
    },
    onMutate: async (userId) => {
      if (!classId) return undefined;
      await queryClient.cancelQueries({ queryKey: rollCallKey(classId) });
      const previous = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
      if (!previous) return { previous: undefined };

      const deck = previous.deck.filter((member) => member.userId !== userId);
      queryClient.setQueryData(rollCallKey(classId), {
        ...previous,
        deck,
        summary: resolveRollCallSummary({ deck, config: previous.config }),
      });
      return { previous };
    },
    onError: (_error, _userId, context) => {
      if (classId && context?.previous) {
        queryClient.setQueryData(rollCallKey(classId), context.previous);
      }
    },
    onSuccess: () => {
      if (classId) {
        flushRollCallInvalidation(queryClient, classId);
      }
    },
  });
}

export function useConfirmRollCallScan(classId: string | null) {
  const queryClient = useQueryClient();
  const coachId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: async (member: RollCallMemberPreview) => {
      if (!classId) throw new Error('Class id is required.');

      const cached = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
      if (!cached?.session || !isRollCallSessionInProgress(cached.session)) {
        await startRollCall(classId);
      }

      await addRollCallClassMember(classId, member.userId, member);

      const clientGeneratedId = createClientGeneratedId();
      const metadata = { client_generated_id: clientGeneratedId };
      const mindbodyClientId = member.mindbodyClientId ?? null;
      const isOnline = getNetworkOnline();

      if (!isOnline) {
        useRollCallOfflineQueueStore.getState().enqueue({
          clientGeneratedId,
          classId,
          mark: {
            userId: member.userId,
            mindbodyClientId,
            status: 'present',
            method: 'qr_scan',
            metadata,
          },
          enqueuedAt: new Date().toISOString(),
        });

        return buildQueuedMarkResponse(
          {
            userId: member.userId,
            mindbodyClientId,
            status: 'present',
            method: 'qr_scan',
            metadata,
          },
          clientGeneratedId,
          coachId,
          cached?.session ?? null,
        );
      }

      return recordRollCallMark({
        classId,
        userId: member.userId,
        mindbodyClientId,
        status: 'present',
        method: 'qr_scan',
        metadata,
      });
    },
    onMutate: async (member) => {
      if (!classId) return undefined;

      await queryClient.cancelQueries({ queryKey: rollCallKey(classId) });
      const previous = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
      if (!previous) return { previous: undefined };

      const mark = {
        id: `optimistic-${Date.now()}`,
        status: 'present' as const,
        method: 'qr_scan' as const,
        markedAt: new Date().toISOString(),
        markedBy: coachId,
        metadata: {},
      };
      const next = upsertOptimisticRosterMember(previous, member, mark);
      queryClient.setQueryData(rollCallKey(classId), next);

      return { previous };
    },
    onError: (_error, _member, context) => {
      if (classId && context?.previous) {
        queryClient.setQueryData(rollCallKey(classId), context.previous);
      }
    },
    onSuccess: (response, member) => {
      if (!classId) return;

      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;
        const withServerMark = patchRollCallDeckMark(current, member.userId, response.mark);
        return {
          ...withServerMark,
          session: response.session,
        };
      });
      flushRollCallInvalidation(queryClient, classId);
    },
  });
}
