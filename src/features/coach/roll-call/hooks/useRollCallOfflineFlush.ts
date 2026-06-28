import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushRollCallOfflineQueue } from '@/features/coach/roll-call/utils/rollCallOfflineQueue';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function useRollCallOfflineFlush(enabled = true) {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const queueLength = useRollCallOfflineQueueStore((state) => state.queue.length);

  useEffect(() => {
    if (!enabled || !isOnline || queueLength === 0) return;
    void flushRollCallOfflineQueue(queryClient);
  }, [enabled, isOnline, queueLength, queryClient]);
}
