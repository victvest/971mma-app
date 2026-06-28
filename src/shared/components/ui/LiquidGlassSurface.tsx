import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useTheme } from '@/shared/theme';

export type LiquidGlassVariant = 'default' | 'chrome';

export const LIQUID_GLASS_BLUR_INTENSITY = { default: 55, chrome: 72 } as const;

type Props = {
  children: React.ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  variant?: LiquidGlassVariant;
  /** When false, omits the built-in hairline border (e.g. when an outer frame draws the edge). */
  showBorder?: boolean;
  /**
   * Uses native iOS liquid glass (UIGlassEffect) when available — the refractive
   * "water" look. Falls back to BlurView / opaque surface on unsupported platforms.
   */
  nativeGlass?: boolean;
  /** Optional tint applied to native glass — improves foreground legibility. */
  tintColor?: string;
};

/**
 * macOS Tahoe / iOS 26-style liquid glass surface.
 *
 * iOS: real native blur (UIVisualEffectView) via BlurView, with a
 *   1 px specular top highlight and a white-tinted border — approved only
 *   for static, non-scrolling chrome (header, tab bar, modals, popovers).
 * Android / Web: opaque surface fallback with matching border.
 */
export function LiquidGlassSurface({
  children,
  borderRadius,
  style,
  contentStyle,
  onLayout,
  variant = 'default',
  showBorder = true,
  nativeGlass = true,
  tintColor,
}: Props) {
  const { colors, radius, mode } = useTheme();
  const resolvedRadius = borderRadius ?? radius.card;
  const shellBorderWidth = showBorder ? 0.5 : 0;
  const resolvedTint =
    tintColor ??
    (variant === 'chrome' && nativeGlass
      ? mode === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.42)'
      : undefined);

  if (Platform.OS === 'ios' && nativeGlass && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle={variant === 'chrome' ? 'clear' : 'regular'}
        colorScheme={mode === 'dark' ? 'dark' : 'light'}
        tintColor={resolvedTint}
        onLayout={onLayout}
        style={[
          styles.shell,
          {
            borderRadius: resolvedRadius,
          },
          style,
        ]}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  if (Platform.OS === 'ios') {
    const intensity = variant === 'chrome' ? 82 : 65;
    const tint = mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight';

    // Premium translucent overlay colors that blend nicely without looking flat or very grey
    const glassBackgroundColor = mode === 'dark'
      ? 'rgba(25, 25, 22, 0.45)'
      : 'rgba(255, 255, 255, 0.55)';

    const resolvedBorderColor = showBorder
      ? mode === 'dark'
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.08)'
      : 'transparent';

    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        onLayout={onLayout}
        style={[
          styles.shell,
          {
            borderRadius: resolvedRadius,
            borderWidth: shellBorderWidth,
            borderColor: resolvedBorderColor,
            backgroundColor: glassBackgroundColor,
          },
          style,
        ]}
      >
        {/* 1 px specular highlight — gives the "wet" top edge */}
        {showBorder ? (
          <View
            pointerEvents="none"
            style={[
              styles.specular,
              {
                borderTopLeftRadius: resolvedRadius,
                borderTopRightRadius: resolvedRadius,
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)',
              },
            ]}
          />
        ) : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    );
  }

  // Android / Web fallback — semi-translucent/opaque surface with matching shape
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.shell,
        {
          borderRadius: resolvedRadius,
          borderWidth: shellBorderWidth,
          borderColor: showBorder ? colors.border.subtle : 'transparent',
          backgroundColor: variant === 'chrome'
            ? mode === 'dark' ? 'rgba(25, 25, 22, 0.92)' : 'rgba(255, 255, 255, 0.92)'
            : colors.background.elevated,
        },
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

/** Returns background color for non-BlurView usage sites */
export function liquidGlassBackgroundColor(
  _mode: 'light' | 'dark',
  _variant: LiquidGlassVariant = 'default',
): string | undefined {
  return undefined;
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    position: 'relative',
  },
  specular: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
});
