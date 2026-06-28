import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { networkStatusFromNetInfo } from '@/core/connectivity/mapNetInfoState';
import { useAppConnectivityStore } from '@/stores/useAppConnectivityStore';

let installed = false;

function applyNetInfoState(state: NetInfoState): void {
  useAppConnectivityStore.getState().setNetworkStatus(networkStatusFromNetInfo(state));
}

function applyAppState(status: AppStateStatus): void {
  useAppConnectivityStore.getState().setAppFocused(status === 'active');
}

/**
 * Registers one NetInfo listener, one AppState listener, TanStack Query
 * online/focus managers, and the shared connectivity store.
 */
export function installConnectivityBridge(): void {
  if (installed) return;
  installed = true;

  onlineManager.setEventListener((setOnline) => {
    const onNetInfoChange = (state: NetInfoState) => {
      const { isOnline } = networkStatusFromNetInfo(state);
      setOnline(isOnline);
      applyNetInfoState(state);
    };

    void NetInfo.fetch().then(onNetInfoChange);
    return NetInfo.addEventListener(onNetInfoChange);
  });

  focusManager.setEventListener((setFocused) => {
    const onAppStateChange = (status: AppStateStatus) => {
      const focused = status === 'active';
      setFocused(focused);
      applyAppState(status);
    };

    onAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  });
}

/**
 * Re-read device network state before flushing queued roll-call marks.
 */
export async function refreshNetworkOnlineFromDevice(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const status = networkStatusFromNetInfo(state);
  useAppConnectivityStore.getState().setNetworkStatus(status);
  onlineManager.setOnline(status.isOnline);
  return status.isOnline;
}
