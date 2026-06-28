import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

/**
 * Top safe-area inset for layout inside the app shell.
 * When the global offline banner is visible it already consumes the status-bar
 * inset, so nested screens should not apply it again.
 */
export function useAppTopInset(): number {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  return isOnline ? insets.top : 0;
}
