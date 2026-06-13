/**
 * 971 MMA color system.
 * Pure white surfaces, deep UAE-flag green + brand red accents, near-black ink.
 */
export const palette = {
  white: '#FFFFFF',
  black: '#0B0B0C',

  // UAE green (primary brand accent)
  green: '#15633A',
  greenBright: '#1F8B4C',
  greenDeep: '#0F4A2B',
  greenSoft: '#E8F3ED',

  // UAE / 971 red (secondary accent + live states)
  red: '#E8192C',
  redSoft: '#FDEAEC',

  // Neutrals
  ink: '#0B0B0C',
  ink70: '#3A3A3D',
  muted: '#6B7280',
  faint: '#9AA0A6',
  line: '#ECEDEF',
  lineStrong: '#E0E2E5',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F7F8',
  surfaceSunken: '#F1F2F4',

  gold: '#C8A24B',
} as const;

export const colors = {
  bg: palette.white,
  bgAlt: palette.surfaceAlt,
  surfaceAlt: palette.surfaceAlt,
  surfaceSunken: palette.surfaceSunken,
  card: palette.surface,
  cardAlt: palette.surfaceAlt,
  header: palette.black,

  accent: palette.green,
  accentBright: palette.greenBright,
  accentSoft: palette.greenSoft,

  danger: palette.red,
  dangerSoft: palette.redSoft,

  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  onAccent: palette.white,
  onDark: palette.white,

  border: palette.line,
  borderStrong: palette.lineStrong,
} as const;

export type ThemeColors = typeof colors;
