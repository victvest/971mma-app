import type { QueryClient } from '@tanstack/react-query';
import type {
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallState,
} from '@/features/coach/roll-call/types';
import { isUnsyncedRollCallMark } from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import { rollCallKey } from '@/features/coach/roll-call/hooks/rollCallQueryKeys';
import { recordRollCallMark } from '@/services/database/rollCall.repository';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import {
  createClientGeneratedId,
} from '@/features/coach/roll-call/utils/rollCallOfflineQueue';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';

function pendingMembers(deck: RollCallDeckMember[]): RollCallDeckMember[] {
  return deck.filter((member) => member.mark && isUnsyncedRollCallMark(member.mark));
}

/**
 * Push every locally-held swipe/summary mark to the server once — used on final submit.
 * No-ops when everything is already synced.
 */
export async function flushPendingRollCallMarks(
  queryClient: QueryClient,
  classId: string,
): Promise<void> {
  const state = queryClient.getQueryData<RollCallState>(rollCallKey(classId));
  if (!state) return;

  const pending = pendingMembers(state.deck);
  if (pending.length === 0) return;

  const isOnline = getNetworkOnline();

  for (const member of pending) {
    const mark = member.mark as RollCallMemberMark;
    const clientGeneratedId =
      typeof mark.metadata?.client_generated_id === 'string'
        ? mark.metadata.client_generated_id
        : createClientGeneratedId();
    const metadata = {
      ...mark.metadata,
      client_generated_id: clientGeneratedId,
    };

    if (!isOnline) {
      useRollCallOfflineQueueStore.getState().enqueue({
        clientGeneratedId,
        classId,
        mark: {
          userId: member.userId,
          mindbodyClientId: member.mindbodyClientId || null,
          status: mark.status,
          method: mark.method,
          metadata,
        },
        enqueuedAt: new Date().toISOString(),
      });
      continue;
    }

    const response = await recordRollCallMark({
      classId,
      userId: member.userId,
      mindbodyClientId: member.mindbodyClientId || null,
      status: mark.status,
      method: mark.method,
      metadata,
    });

    queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
      if (!current) return current;
      return {
        ...current,
        session: response.session ?? current.session,
        deck: current.deck.map((row) =>
          row.deckKey === member.deckKey ? { ...row, mark: response.mark } : row,
        ),
      };
    });
  }
}
