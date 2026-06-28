import { Platform } from 'react-native';
import {
  displayMinFontSize,
  fontFamily as fontFamilyRefs,
  resolveFontFamily,
  resolveFontRole,
  type FontRole,
} from './fonts';

export { displayMinFontSize, fontStacks, resolveFontFamily, resolveFontRole } from './fonts';
export type { FontRole } from './fonts';

export const fontFamily = {
  ...fontFamilyRefs,
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) as string,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

export const fontSize = {
  '2xs': 10,
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
} as const;

export const letterSpacing = {
  tighter: -1.0,
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
  widest: 1.6,
} as const;

type TextPreset = {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
};

type PresetOptions = {
  transform?: TextPreset['textTransform'];
  /** Override automatic display/body selection (default: ≥17px → display) */
  role?: FontRole;
};

function preset(
  size: number,
  weight: FontWeight,
  lhRatio: number,
  ls: number = 0,
  options?: PresetOptions,
): TextPreset {
  const role = resolveFontRole(size, options?.role);
  return {
    fontFamily: resolveFontFamily(role, weight),
    fontSize: size,
    fontWeight: '400',
    lineHeight: Math.round(size * lhRatio),
    letterSpacing: ls,
    ...(options?.transform ? { textTransform: options.transform } : {}),
  };
}

export const textPresets = {
  display: preset(fontSize['6xl'], fontWeight.black, 1.05, letterSpacing.tighter),

  hero: preset(fontSize['5xl'], fontWeight.black, 1.1, letterSpacing.tighter),

  /** Home dashboard headline — matches legacy 38px/42lh layout */
  homeHero: {
    fontFamily: resolveFontFamily('display', fontWeight.black),
    fontSize: 38,
    fontWeight: '400',
    lineHeight: 42,
    letterSpacing: letterSpacing.tighter,
  } satisfies TextPreset,

  heading: preset(fontSize['4xl'], fontWeight.extrabold, 1.15, letterSpacing.tight),

  authTitle: preset(fontSize['4xl'], fontWeight.black, 1.15, letterSpacing.normal),

  subheading: preset(fontSize['3xl'], fontWeight.bold, 1.2, letterSpacing.tight),

  authEyebrow: preset(fontSize.sm, fontWeight.semibold, 1.4, letterSpacing.normal, {
    role: 'body',
  }),

  screenEyebrow: preset(fontSize.sm, fontWeight.bold, 1.35, letterSpacing.widest, {
    role: 'body',
    transform: 'uppercase',
  }),

  academyKicker: preset(fontSize.xs, fontWeight.bold, 1.3, letterSpacing.widest, {
    role: 'body',
    transform: 'uppercase',
  }),

  coachDisplay: preset(fontSize['6xl'], fontWeight.black, 1.04, letterSpacing.normal),

  coachDisplayCompact: preset(fontSize['5xl'], fontWeight.black, 1.05, letterSpacing.normal),

  coachName: preset(fontSize['4xl'], fontWeight.black, 1.05, letterSpacing.normal),

  coachSectionTitle: preset(fontSize['3xl'], fontWeight.black, 1.1, letterSpacing.normal),

  metricValue: preset(fontSize['3xl'], fontWeight.black, 1.08, letterSpacing.normal),

  metricLabel: preset(fontSize.xs, fontWeight.bold, 1.4, letterSpacing.widest, {
    role: 'body',
    transform: 'uppercase',
  }),

  title: preset(fontSize['2xl'], fontWeight.bold, 1.25, letterSpacing.tight),

  subtitle: preset(fontSize.xl, fontWeight.semibold, 1.3, letterSpacing.normal),

  callout: preset(fontSize.lg, fontWeight.semibold, 1.35, letterSpacing.normal),

  body: preset(fontSize.md, fontWeight.regular, 1.53, letterSpacing.normal, { role: 'body' }),

  bodyMedium: preset(fontSize.md, fontWeight.medium, 1.53, letterSpacing.normal, { role: 'body' }),

  bodyStrong: preset(fontSize.md, fontWeight.semibold, 1.53, letterSpacing.normal, { role: 'body' }),

  footnote: preset(fontSize.sm, fontWeight.regular, 1.46, letterSpacing.normal, { role: 'body' }),

  caption: preset(fontSize.xs, fontWeight.regular, 1.4, letterSpacing.normal, { role: 'body' }),

  captionMedium: preset(fontSize.xs, fontWeight.medium, 1.4, letterSpacing.normal, { role: 'body' }),

  label: preset(fontSize['2xs'], fontWeight.bold, 1.4, letterSpacing.widest, {
    role: 'body',
    transform: 'uppercase',
  }),

  button: preset(fontSize.md, fontWeight.bold, 1.2, letterSpacing.normal, { role: 'body' }),

  buttonSmall: preset(fontSize.sm, fontWeight.bold, 1.2, letterSpacing.wide, { role: 'body' }),

  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: Math.round(fontSize.sm * 1.5),
    letterSpacing: 0,
  } satisfies TextPreset,
} as const;

export type TextPresetKey = keyof typeof textPresets;
