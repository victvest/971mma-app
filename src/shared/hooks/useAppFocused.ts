import { useAppConnectivityStore } from '@/stores/useAppConnectivityStore';

export function useAppFocused(): boolean {
  return useAppConnectivityStore((state) => state.isAppFocused);
}
