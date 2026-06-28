import type { QueryClient } from '@tanstack/react-query';
import { refreshNetworkOnlineFromDevice } from '@/core/connectivity';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import { flushRollCallInvalidation } from '@/features/coach/roll-call/hooks/rollCallQueryKeys';
import type {
  RecordRollCallMarkInput,
  RecordRollCallMarkResponse,
  RollCallMemberMark,
  RollCallSessionView,
} from '@/features/coach/roll-call/types';
import { recordRollCallMark } from '@/services/database/rollCall.repository';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';

export type RollCallQueuedMark = {
  clientGeneratedId: string;
  classId: string;
  mark: RecordRollCallMarkInput;
  enqueuedAt: string;
};

export function memberRefKey(mark: RecordRollCallMarkInput): string {
  if (mark.userId) return mark.userId;
  if (mark.mindbodyClientId) return `mb:${mark.mindbodyClientId}`;
  return 'unknown';
}

export function createClientGeneratedId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function readNetworkOnline(options?: { safetyCheck?: boolean }): Promise<boolean> {
  if (options?.safetyCheck) {
    return refreshNetworkOnlineFromDevice();
  }
  return getNetworkOnline();
}

export function buildQueuedMarkResponse(
  input: RecordRollCallMarkInput,
  clientGeneratedId: string,
  coachId: string,
  session: RollCallSessionView | null,
): RecordRollCallMarkResponse {
  const mark: RollCallMemberMark = {
    id: `queued-${clientGeneratedId}`,
    status: input.status,
    method: input.method ?? 'roll_call',
    markedAt: new Date().toISOString(),
    markedBy: coachId,
    metadata: {
      ...input.metadata,
      client_generated_id: clientGeneratedId,
    },
  };

  return {
    mark,
    session:
      session ??
      ({
        id: 'offline-session',
        classId: '',
        coachId,
        status: 'in_progress',
        deckCursor: 0,
        startedAt: null,
        completedAt: null,
      } satisfies RollCallSessionView),
  };
}

let flushInFlight: Promise<void> | null = null;

export async function flushRollCallOfflineQueue(queryClient: QueryClient): Promise<void> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const isOnline = await readNetworkOnline({ safetyCheck: true });
    if (!isOnline) return;

    const store = useRollCallOfflineQueueStore.getState();
    const seenClientIds = new Set<string>();
    const pending = [...store.queue].sort(
      (a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt),
    );

    for (const item of pending) {
      if (seenClientIds.has(item.clientGeneratedId)) {
        store.removeByClientId(item.clientGeneratedId);
        continue;
      }
      seenClientIds.add(item.clientGeneratedId);

      try {
        await recordRollCallMark({
          classId: item.classId,
          userId: item.mark.userId,
          mindbodyClientId: item.mark.mindbodyClientId,
          status: item.mark.status,
          method: item.mark.method ?? 'roll_call',
          metadata: {
            ...item.mark.metadata,
            client_generated_id: item.clientGeneratedId,
          },
        });
        store.removeByClientId(item.clientGeneratedId);
        flushRollCallInvalidation(queryClient, item.classId);
      } catch {
        break;
      }
    }
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}

export function pendingQueueCountForClass(classId: string): number {
  return useRollCallOfflineQueueStore
    .getState()
    .queue.filter((entry) => entry.classId === classId).length;
}
