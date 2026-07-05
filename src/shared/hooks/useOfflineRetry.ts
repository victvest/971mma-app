import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reconnectFromOffline } from '@/core/connectivity/reconnectFromOffline';
import { toast } from '@/shared/components/Toast';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function useOfflineRetry(action: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  return useCallback(async () => {
    if (networkStatusKnown && !isOnline) {
      const online = await reconnectFromOffline(queryClient);
      if (!online) {
        toast.warning('No connection', 'Reconnect to the internet, then try again.');
        return;
      }
    }

    await action();
  }, [action, isOnline, networkStatusKnown, queryClient]);
}
