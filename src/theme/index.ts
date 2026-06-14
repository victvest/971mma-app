import { Platform } from 'react-native';
import { colors, palette } from './colors';
import { fonts, fontAssets } from './fonts';

export { colors, palette, fonts, fontAssets };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/**
 * Liquid-glass surface tokens. Pair `fill` + `border` with a `BlurView` (see
 * `GlassSurface`) to get the frosted look; `sheen` is a top highlight gradient.
 */
export const glass = {
  fill: palette.glass06,
  fillStrong: palette.glass12,
  fillSubtle: palette.glass04,
  border: palette.hairline,
  borderStrong: palette.hairlineStrong,
  sheenTop: 'rgba(255,255,255,0.75)',
  sheenBottom: 'rgba(255,255,255,0)',
  tint: 'rgba(255,255,255,0.5)',
  blur: Platform.select({ ios: 28, android: 22, default: 24 }) as number,
  blurStrong: Platform.select({ ios: 48, android: 36, default: 32 }) as number,
} as const;

/** Soft tinted glows used under primary actions, badges and highlights. */
export const glow = {
  green: {
    shadowColor: palette.green,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  red: {
    shadowColor: palette.red,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  gold: {
    shadowColor: palette.gold,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: '#16271D',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  floating: {
    shadowColor: '#16271D',
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 14,
  },
  soft: {
    shadowColor: '#16271D',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;

export const typography = {
  display: { fontFamily: fonts.displayBlack, fontSize: 46, lineHeight: 48, letterSpacing: 0.2 },
  h1: { fontFamily: fonts.displayBlack, fontSize: 34, lineHeight: 36, letterSpacing: 0.2 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semi, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.semi,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0,
  },
  stat: { fontFamily: fonts.displayBlack, fontSize: 30, lineHeight: 32, letterSpacing: 0.3 },
} as const;

export const theme = { colors, palette, spacing, radii, typography, shadow, glass, glow, fonts };
export type Theme = typeof theme;
