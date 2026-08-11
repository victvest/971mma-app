import type { NetInfoState } from '@react-native-community/netinfo';

export function isNetworkOnline(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  if (state.isConnected !== true) return false;

  // Prefer an explicit reachability success when NetInfo provides it.
  if (state.isInternetReachable === true) return true;

  // Link-layer connectivity is the reliable signal. isInternetReachable === false is
  // often a false negative on iOS simulators, VPNs, and during network handoffs.
  return true;
}

export function networkStatusFromNetInfo(state: NetInfoState): {
  isOnline: boolean;
  connectionType: string | null;
} {
  return {
    isOnline: isNetworkOnline(state),
    connectionType: state.type ?? null,
  };
}
