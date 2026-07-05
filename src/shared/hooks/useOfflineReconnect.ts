import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reconnectFromOffline } from '@/core/connectivity/reconnectFromOffline';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact } from '@/shared/haptics';

const MIN_RETRY_VISIBLE_MS = 400;

export function useOfflineReconnect() {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);

  const retry = useCallback(async (): Promise<boolean> => {
    if (retryingRef.current) return false;

    retryingRef.current = true;
    setRetrying(true);
    triggerLightImpact();

    const startedAt = Date.now();

    try {
      const online = await reconnectFromOffline(queryClient);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_RETRY_VISIBLE_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_RETRY_VISIBLE_MS - elapsed));
      }

      if (!online) {
        toast.warning('Still offline', 'Check your connection and try again.');
      }

      return online;
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  }, [queryClient]);

  return { retry, retrying };
}
