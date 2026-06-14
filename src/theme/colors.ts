/**
 * 971 MMA — premium "liquid glass" dark color system.
 *
 * Deep near-black canvas, translucent frosted-glass surfaces, UAE-flag green as
 * the signature glow, brand red for live states, and gold for premium tiers.
 * The exported `colors` keys are kept stable so every screen/component keeps
 * compiling; only their values moved from the old white theme to dark glass.
 */
export const palette = {
  white: '#FFFFFF',
  black: '#05070B',

  // Canvas (layered near-blacks with a faint cool cast)
  abyss: '#04060A',
  ink900: '#070A0F',
  ink800: '#0B0F16',
  ink700: '#11161F',
  ink600: '#171D28',

  // UAE green — the brand glow (brightened for dark surfaces)
  green: '#27D17C',
  greenBright: '#4DE89A',
  greenDeep: '#13643C',
  greenCore: '#1F8B4C',
  greenGlass: 'rgba(39,209,124,0.14)',
  greenLine: 'rgba(39,209,124,0.32)',

  // 971 brand red — live / alert
  red: '#FF3B4E',
  redBright: '#FF6273',
  redDeep: '#B3121F',
  redGlass: 'rgba(255,59,78,0.15)',

  // Gold — premium / elite tier
  gold: '#E7C77A',
  goldBright: '#F4DDA0',
  goldDeep: '#C8A24B',
  goldGlass: 'rgba(231,199,122,0.16)',

  // Frosted glass tints
  glass04: 'rgba(255,255,255,0.04)',
  glass06: 'rgba(255,255,255,0.06)',
  glass08: 'rgba(255,255,255,0.08)',
  glass12: 'rgba(255,255,255,0.12)',
  glass16: 'rgba(255,255,255,0.16)',
  hairline: 'rgba(255,255,255,0.10)',
  hairlineStrong: 'rgba(255,255,255,0.18)',
  sheen: 'rgba(255,255,255,0.22)',

  // Ink / text
  textHi: '#F5F8FC',
  textMid: '#AAB3C0',
  textLow: '#6E7886',
} as const;

export const colors = {
  bg: palette.ink900,
  bgDeep: palette.abyss,
  bgAlt: palette.ink800,
  surfaceAlt: palette.glass06,
  surfaceSunken: palette.glass04,
  card: palette.glass06,
  cardAlt: palette.glass04,
  header: palette.ink900,

  accent: palette.green,
  accentBright: palette.greenBright,
  accentSoft: palette.greenGlass,

  danger: palette.red,
  dangerSoft: palette.redGlass,

  gold: palette.gold,
  goldSoft: palette.goldGlass,

  text: palette.textHi,
  textMuted: palette.textMid,
  textFaint: palette.textLow,
  onAccent: '#04150C',
  onDark: palette.white,

  border: palette.hairline,
  borderStrong: palette.hairlineStrong,
} as const;

export type ThemeColors = typeof colors;
