import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

type ThemeMode = 'light' | 'dark';

/** Selected-tab capsule — soft emerald glass pill (inspiration: muted highlight behind icon + label). */
export const GLASS_TAB_ACTIVE = {
  capsuleFill: 'rgba(0, 132, 61, 0.16)',
  capsuleFillDark: 'rgba(0, 168, 79, 0.22)',
  capsuleBorder: 'rgba(255, 255, 255, 0.55)',
  capsuleBorderDark: 'rgba(255, 255, 255, 0.14)',
  foreground: '#00843D',
  foregroundDark: '#34D399',
} as const;

export function glassTabActiveCapsule(mode: ThemeMode, borderRadius: number): ViewStyle {
  return {
    backgroundColor: mode === 'dark' ? GLASS_TAB_ACTIVE.capsuleFillDark : GLASS_TAB_ACTIVE.capsuleFill,
    borderColor: mode === 'dark' ? GLASS_TAB_ACTIVE.capsuleBorderDark : GLASS_TAB_ACTIVE.capsuleBorder,
    borderRadius,
    borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0.5,
  };
}

export function glassTabActiveForeground(mode: ThemeMode): string {
  return mode === 'dark' ? GLASS_TAB_ACTIVE.foregroundDark : GLASS_TAB_ACTIVE.foreground;
}

/** Soft halo so inactive icons stay visible over refractive liquid-glass backgrounds. */
export function glassIconHalo(mode: ThemeMode): ViewStyle {
  if (Platform.OS !== 'ios') return {};

  return mode === 'dark'
    ? {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 3,
      }
    : {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      };
}

/** Soft halo so inactive tab labels stay legible over varied content behind the bar. */
export function glassLabelHalo(mode: ThemeMode): TextStyle {
  if (Platform.OS !== 'ios') return {};

  return mode === 'dark'
    ? {
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 3,
      }
    : {
        textShadowColor: 'rgba(255, 255, 255, 0.9)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
      };
}

/** Subtle native-glass tint that lifts foreground contrast without losing the water effect. */
export function glassChromeTint(mode: ThemeMode): string {
  return mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.42)';
}
