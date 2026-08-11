import { Platform, type ViewStyle } from 'react-native';
import { shadows, type ShadowKey } from './shadows';

/** Matches recent-visits tiles in check-in (`colors.border.subtle` + `layout.borderWidth`). */
export const clearedElevation: ViewStyle = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

export function androidSurfaceBorder(borderColor: string, borderWidth = 1): ViewStyle {
  return {
    ...clearedElevation,
    borderColor,
    borderWidth,
  };
}

/** iOS shadow token, or Android grey border matching check-in recent-visit tiles. */
export function resolveShadow(
  borderColor: string,
  key: ShadowKey = 'card',
  borderWidth = 1,
): ViewStyle {
  if (Platform.OS !== 'android') {
    return shadows[key];
  }
  return androidSurfaceBorder(borderColor, borderWidth);
}

/** App bar chrome — bottom edge only on Android (no top/side grey border). */
export function resolveAppBarShadow(borderColor: string, borderWidth = 1): ViewStyle {
  if (Platform.OS !== 'android') {
    return {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    };
  }
  return {
    ...clearedElevation,
    borderBottomColor: borderColor,
    borderBottomWidth: borderWidth,
  };
}

/** Floating nav chrome — iOS shadow or Android grey border ring. */
export function resolveChromeElevation(borderColor: string, borderWidth = 1): ViewStyle {
  if (Platform.OS !== 'android') {
    return {
      shadowColor: '#0F0F0E',
      shadowOffset: { width: 0, height: 2.4 },
      shadowOpacity: 0.072,
      shadowRadius: 7.2,
    };
  }
  return androidSurfaceBorder(borderColor, borderWidth);
}

/** Replace inline shadow+elevation blocks at runtime (StyleSheet cannot access theme). */
export function resolveInlineElevation(
  borderColor: string,
  iosShadow: ViewStyle,
  borderWidth = 1,
): ViewStyle {
  if (Platform.OS !== 'android') {
    return iosShadow;
  }
  return androidSurfaceBorder(borderColor, borderWidth);
}

/** Layer above content without casting an Android shadow (OfflineBanner, status chrome). */
export function androidStackingLayer(zIndex: number): ViewStyle {
  if (Platform.OS !== 'android') {
    return {};
  }
  return {
    ...clearedElevation,
    zIndex,
  };
}
