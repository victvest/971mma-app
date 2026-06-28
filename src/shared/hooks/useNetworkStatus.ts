import { useAppConnectivityStore } from '@/stores/useAppConnectivityStore';

export type NetworkStatus = {
  isOnline: boolean;
  connectionType: string | null;
};

export function useNetworkStatus(): NetworkStatus {
  const isOnline = useAppConnectivityStore((state) => state.isOnline);
  const connectionType = useAppConnectivityStore((state) => state.connectionType);
  return { isOnline, connectionType };
}
