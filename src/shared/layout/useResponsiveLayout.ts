import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';

/** Drawer panel height as a fraction of full screen height — consistent on every device. */
export const DRAWER_HEIGHT_RATIO = 0.9;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = useAppTopInset();

  return useMemo(() => {
    const drawerHorizontalInset = Math.max(12, width * 0.042);
    const drawerTop = topInset + Math.max(8, height * 0.012);
    const drawerHeight = height * DRAWER_HEIGHT_RATIO;
    const drawerRightPeek = Math.max(32, width * 0.1);
    const drawerWidth = Math.max(280, width - drawerHorizontalInset - drawerRightPeek);
    const drawerRadius = Math.max(22, Math.min(32, width * 0.075));
    const drawerPaddingH = Math.max(18, width * 0.055);
    const drawerTitleSize = Math.min(36, Math.max(28, width * 0.09));

    const tabBarHorizontalInset = Math.max(16, width * 0.053);
    const tabBarBottom = Math.max(insets.bottom + 10, 16);
    const tabBarHeight = Math.max(64, Math.min(76, height * 0.092));
    const tabBarRadius = tabBarHeight / 2;
    const tabBarCapsuleInset = Math.max(6, Math.min(8, tabBarHeight * 0.1));

    const contentBottomInset = tabBarBottom + tabBarHeight + 16;

    return {
      drawer: {
        left: drawerHorizontalInset,
        top: drawerTop,
        height: drawerHeight,
        width: drawerWidth,
        radius: drawerRadius,
        paddingH: drawerPaddingH,
        titleSize: drawerTitleSize,
      },
      tabBar: {
        horizontalInset: tabBarHorizontalInset,
        bottom: tabBarBottom,
        height: tabBarHeight,
        radius: tabBarRadius,
        capsuleInset: tabBarCapsuleInset,
        capsuleRadius: tabBarRadius - tabBarCapsuleInset,
        innerPadding: Math.max(6, width * 0.02),
        activeInset: Math.max(8, Math.min(10, tabBarHeight * 0.13)),
      },
      contentBottomInset,
      window: { width, height },
    };
  }, [height, insets.bottom, topInset, width]);
}
