import { create } from 'zustand';

type AppConnectivityState = {
  isOnline: boolean;
  connectionType: string | null;
  isAppFocused: boolean;
};

type AppConnectivityActions = {
  setNetworkStatus: (patch: Pick<AppConnectivityState, 'isOnline' | 'connectionType'>) => void;
  setAppFocused: (isAppFocused: boolean) => void;
};

export const useAppConnectivityStore = create<AppConnectivityState & AppConnectivityActions>((set) => ({
  isOnline: true,
  connectionType: null,
  isAppFocused: true,

  setNetworkStatus: (patch) => set(patch),

  setAppFocused: (isAppFocused) => set({ isAppFocused }),
}));

export function getNetworkOnline(): boolean {
  return useAppConnectivityStore.getState().isOnline;
}

export function getAppFocused(): boolean {
  return useAppConnectivityStore.getState().isAppFocused;
}
