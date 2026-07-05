import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineBannerVisible } from '@/shared/hooks/useOfflineBannerVisible';

/**
 * Top safe-area inset for layout inside the app shell.
 * When the global offline banner is visible it already consumes the status-bar
 * inset, so nested screens should not apply it again.
 */
export function useAppTopInset(): number {
  const insets = useSafeAreaInsets();
  const offlineBannerVisible = useOfflineBannerVisible();
  return offlineBannerVisible ? 0 : insets.top;
}
