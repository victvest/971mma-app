import { useAppConnectivityStore } from '@/stores/useAppConnectivityStore';

export type NetworkStatus = {
  isOnline: boolean;
  connectionType: string | null;
  networkStatusKnown: boolean;
};

export function useNetworkStatus(): NetworkStatus {
  const isOnline = useAppConnectivityStore((state) => state.isOnline);
  const connectionType = useAppConnectivityStore((state) => state.connectionType);
  const networkStatusKnown = useAppConnectivityStore((state) => state.networkStatusKnown);
  return { isOnline, connectionType, networkStatusKnown };
}
