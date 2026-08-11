import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { useTheme } from '@/shared/theme';

import { glassChromeTint } from './glassChromeLegibility';
import { NAV_CHROME } from './uaeChrome';

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
  /** Fixed square frame for circular icon clusters (app bar back/actions). */
  clusterFrame?: ViewStyle;
  /** Fill a fixed-size parent (nav icon clusters). Off for content-sized cards. */
  fillParent?: boolean;
};

function resolveClusterFrame(
  layout: GlassNavChromeLayout,
  style?: StyleProp<ViewStyle>,
): ViewStyle | undefined {
  const flat = StyleSheet.flatten(style);
  if (flat?.width != null && flat?.height != null) {
    return { width: flat.width, height: flat.height };
  }
  if (layout === 'icon') {
    return {
      width: NAV_CHROME.clusterHeight,
      height: NAV_CHROME.clusterHeight,
    };
  }
  return undefined;
}

export function GlassSurface({
  children,
  borderRadius = NAV_CHROME.glassRadius,
  style,
  contentStyle,
  tintColor,
  elevated = true,
  interactive: _interactive,
  showBorder = false,
  clusterFrame,
  fillParent = false,
}: GlassSurfaceProps) {
  const { mode, chromeElevation } = useTheme();

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
    return <View style={[{ borderRadius, overflow: 'hidden' }, clusterFrame, style]}>{shell}</View>;
  }

  return (
    <View
      style={[
        styles.elevated,
        chromeElevation(),
        { borderRadius, overflow: 'hidden' },
        clusterFrame,
        style,
      ]}
    >
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
  const clusterFrame = resolveClusterFrame(layout, style);
  const resolvedContentStyle =
    layout === 'icon' ? [styles.iconClusterContent, contentStyle] : contentStyle;

  const shell = (
    <GlassSurface
      borderRadius={borderRadius}
      contentStyle={resolvedContentStyle}
      tintColor={tintColor}
      clusterFrame={clusterFrame}
      fillParent={Boolean(clusterFrame)}
      style={clusterFrame ? undefined : style}
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
      style={({ pressed }) => [clusterFrame, style, pressed && styles.pressed]}
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
  pressed: {
    opacity: 0.82,
  },
});
