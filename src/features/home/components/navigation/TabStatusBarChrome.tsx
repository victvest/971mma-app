import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useOfflineBannerVisible } from '@/shared/hooks/useOfflineBannerVisible';
import { useTheme, androidStackingLayer } from '@/shared/theme';

/** Status-bar fill matches the app screen background — seamless with home content. */
export function TabStatusBarChrome() {
  const topInset = useAppTopInset();
  const offlineBannerVisible = useOfflineBannerVisible();
  const { colors } = useTheme();
  const backgroundColor = colors.background.primary;

  if (offlineBannerVisible) {
    // Red offline banner owns the status bar — keep icons light, no white fill.
    return <AppStatusBar style="light" backgroundColor={colors.status.error} translucent />;
  }

  return (
    <>
      {topInset > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.fill, { height: topInset, backgroundColor }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <AppStatusBar style="dark" backgroundColor={backgroundColor} translucent={false} />
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1100,
    ...androidStackingLayer(1100),
  },
});
