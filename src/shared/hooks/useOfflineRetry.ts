import { useCallback } from 'react';
import { toast } from '@/shared/components/Toast';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function useOfflineRetry(action: () => void | Promise<void>) {
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  return useCallback(() => {
    if (networkStatusKnown && !isOnline) {
      toast.warning('No connection', 'Reconnect to the internet, then try again.');
      return;
    }
    void action();
  }, [action, isOnline, networkStatusKnown]);
}
