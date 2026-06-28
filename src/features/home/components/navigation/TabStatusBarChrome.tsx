import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useTheme } from '@/shared/theme';

/** Status-bar fill matches the app screen background — seamless with home content. */
export function TabStatusBarChrome() {
  const topInset = useAppTopInset();
  const { colors } = useTheme();
  const backgroundColor = colors.background.primary;

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
    ...Platform.select({
      android: { elevation: 1100 },
    }),
  },
});
