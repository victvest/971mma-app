import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { useTheme } from '@/shared/theme';

import { glassChromeTint } from './glassChromeLegibility';
import { NAV_CHROME } from './uaeChrome';
import { FLOATING_CHROME_ELEVATION } from './floatingChromeElevation';

type GlassNavChromeLayout = 'icon' | 'bar';

type GlassNavChromeProps = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  tintColor?: string;
  testID?: string;
  /** `icon` centers a single glyph; `bar` preserves caller content layout (e.g. title row). */
  layout?: GlassNavChromeLayout;
};

type GlassSurfaceProps = {
  children: React.ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  elevated?: boolean;
  interactive?: boolean;
  showBorder?: boolean;
  /** Fill a fixed-size parent (nav icon clusters). Off for content-sized cards. */
  fillParent?: boolean;
};

export function GlassSurface({
  children,
  borderRadius = NAV_CHROME.glassRadius,
  style,
  contentStyle,
  tintColor,
  elevated = true,
  interactive: _interactive,
  showBorder = false,
  fillParent = false,
}: GlassSurfaceProps) {
  const { mode } = useTheme();

  const shell = (
    <LiquidGlassSurface
      variant="chrome"
      borderRadius={borderRadius}
      tintColor={tintColor ?? glassChromeTint(mode)}
      showBorder={showBorder}
      style={fillParent ? styles.glassFill : styles.glassStretch}
      contentStyle={contentStyle}
    >
      {children}
    </LiquidGlassSurface>
  );

  if (!elevated) {
    return (
      <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
        {shell}
      </View>
    );
  }

  return (
    <View style={[styles.elevated, FLOATING_CHROME_ELEVATION, { borderRadius }, style]}>
      {shell}
    </View>
  );
}

export function GlassNavChrome({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  contentStyle,
  borderRadius = NAV_CHROME.glassRadius,
  tintColor,
  testID,
  layout = 'icon',
}: GlassNavChromeProps) {
  const resolvedContentStyle =
    layout === 'icon' ? [styles.iconClusterContent, contentStyle] : contentStyle;

  const shell = (
    <GlassSurface
      borderRadius={borderRadius}
      contentStyle={resolvedContentStyle}
      tintColor={tintColor}
      fillParent={Boolean(onPress) || layout === 'icon'}
      style={onPress ? styles.pressableFill : style}
    >
      {children}
    </GlassSurface>
  );

  if (!onPress) {
    return shell;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={6}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {shell}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  elevated: {
    backgroundColor: 'transparent',
  },
  glassFill: {
    height: '100%',
    width: '100%',
  },
  glassStretch: {
    alignSelf: 'stretch',
    width: '100%',
  },
  iconClusterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressableFill: {
    height: '100%',
    width: '100%',
  },
  pressed: {
    opacity: 0.82,
  },
});
