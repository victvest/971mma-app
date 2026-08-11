import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useTheme } from '@/shared/theme';

/** Top padding for scroll content below a floating `AppBar`. */
export function useFloatingAppBarContentInset(extraGap = 12): number {
  const topInset = useAppTopInset();
  const { layout } = useTheme();
  return topInset + layout.headerHeight + layout.appBarBottomInset + extraGap;
}
