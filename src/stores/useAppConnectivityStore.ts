import { create } from 'zustand';

type AppConnectivityState = {
  isOnline: boolean;
  connectionType: string | null;
  networkStatusKnown: boolean;
  isAppFocused: boolean;
};

type AppConnectivityActions = {
  setNetworkStatus: (
    patch: Pick<AppConnectivityState, 'isOnline' | 'connectionType'> & {
      networkStatusKnown?: boolean;
    },
  ) => void;
  setAppFocused: (isAppFocused: boolean) => void;
};

export const useAppConnectivityStore = create<AppConnectivityState & AppConnectivityActions>((set) => ({
  isOnline: false,
  connectionType: null,
  networkStatusKnown: false,
  isAppFocused: true,

  setNetworkStatus: (patch) =>
    set((state) => ({
      ...state,
      ...patch,
      networkStatusKnown: patch.networkStatusKnown ?? true,
    })),

  setAppFocused: (isAppFocused) => set({ isAppFocused }),
}));

export function getNetworkOnline(): boolean {
  return useAppConnectivityStore.getState().isOnline;
}

export function getAppFocused(): boolean {
  return useAppConnectivityStore.getState().isAppFocused;
}
