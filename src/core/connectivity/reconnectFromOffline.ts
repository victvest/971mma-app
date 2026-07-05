import type { QueryClient } from '@tanstack/react-query';
import { refreshNetworkOnlineFromDevice } from './installConnectivityBridge';

/** Re-read device connectivity and refresh server state when back online. */
export async function reconnectFromOffline(queryClient: QueryClient): Promise<boolean> {
  const online = await refreshNetworkOnlineFromDevice();
  if (online) {
    await queryClient.invalidateQueries();
  }
  return online;
}
