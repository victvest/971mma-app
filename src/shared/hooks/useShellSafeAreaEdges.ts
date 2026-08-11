import type { Edge, Edges } from 'react-native-safe-area-context';
import { useOfflineBannerVisible } from '@/shared/hooks/useOfflineBannerVisible';

const DEFAULT_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * When the global offline banner is visible it already reserves the status-bar
 * inset — nested screens must not apply `top` safe area again.
 */
export function useShellSafeAreaEdges(edges?: Edges): Edges | undefined {
  const offlineBannerVisible = useOfflineBannerVisible();

  if (!offlineBannerVisible) {
    return edges;
  }

  // Object form (e.g. { top: 'additive', bottom: 'maximum' }): disable the top inset.
  if (edges && !Array.isArray(edges)) {
    return { ...edges, top: 'off' };
  }

  const base: Edge[] = edges ?? DEFAULT_EDGES;
  // Empty array is intentional: it means "no safe-area edges".
  // Returning undefined would re-apply the default edges (including top).
  return base.filter((edge) => edge !== 'top');
}
