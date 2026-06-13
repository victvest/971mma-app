import { Platform } from 'react-native';
import { colors, palette } from './colors';

export { colors, palette };

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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

const heavy = Platform.select({ ios: '800', android: '800', default: '800' }) as '800';
const bold = Platform.select({ ios: '700', android: '700', default: '700' }) as '700';

export const typography = {
  display: { fontSize: 40, lineHeight: 42, fontWeight: heavy, letterSpacing: -1 },
  h1: { fontSize: 30, lineHeight: 34, fontWeight: heavy, letterSpacing: -0.6 },
  h2: { fontSize: 22, lineHeight: 27, fontWeight: bold, letterSpacing: -0.3 },
  h3: { fontSize: 18, lineHeight: 23, fontWeight: bold, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  stat: { fontSize: 26, lineHeight: 28, fontWeight: heavy, letterSpacing: -0.5 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B1A12',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  soft: {
    shadowColor: '#0B1A12',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const theme = { colors, palette, spacing, radii, typography, shadow };
export type Theme = typeof theme;
