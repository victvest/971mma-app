import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

/** True when the global red offline banner is rendered in the app shell. */
export function useOfflineBannerVisible(): boolean {
  const { isOnline, networkStatusKnown } = useNetworkStatus();
  return networkStatusKnown && !isOnline;
}
