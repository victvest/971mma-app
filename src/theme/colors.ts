/**
 * 971 MMA — premium light "liquid glass" color system.
 *
 * Clean near-white canvas with a faint cool cast, frosted translucent-white
 * surfaces, UAE-flag deep green as the signature accent, brand red for live
 * states, gold reserved for premium/Elite, and near-black ink for type.
 *
 * The exported `colors` keys are kept stable so every screen/component keeps
 * compiling; the values express the refined light theme.
 */
export const palette = {
  white: '#FFFFFF',
  black: '#0B0B0C',

  // Canvas (near-whites with a faint green-cool cast for depth)
  abyss: '#EAEFEC',
  ink900: '#F1F4F2',
  ink800: '#F8FAF9',
  ink700: '#FFFFFF',
  ink600: '#EFF3F0',

  // UAE green — primary brand accent
  green: '#15633A',
  greenBright: '#1F8B4C',
  greenDeep: '#0F4A2B',
  greenCore: '#15633A',
  greenGlass: 'rgba(21,99,58,0.10)',
  greenLine: 'rgba(21,99,58,0.22)',

  // Blood red — live / alert (deep, not neon)
  red: '#8B1E22',
  redBright: '#A0282C',
  redDeep: '#5E1014',
  redGlass: 'rgba(139,30,34,0.12)',
  redLine: 'rgba(139,30,34,0.28)',

  // Gold — premium / Elite tier
  gold: '#A8842F',
  goldBright: '#E7C77A',
  goldDeep: '#8A6A1F',
  goldGlass: 'rgba(200,162,75,0.16)',

  // Frosted glass tints (translucent WHITE — sit over the tinted canvas)
  glass04: 'rgba(255,255,255,0.50)',
  glass06: 'rgba(255,255,255,0.66)',
  glass08: 'rgba(255,255,255,0.80)',
  glass12: 'rgba(255,255,255,0.88)',
  glass16: 'rgba(255,255,255,0.94)',

  // Inset tints (subtle ink — for chips/inputs nested on white surfaces)
  inset: 'rgba(13,18,16,0.05)',
  insetStrong: 'rgba(13,18,16,0.08)',
  pressed: 'rgba(13,18,16,0.06)',

  hairline: 'rgba(15,23,18,0.09)',
  hairlineStrong: 'rgba(15,23,18,0.15)',
  sheen: 'rgba(255,255,255,0.85)',

  // Ink / text
  textHi: '#0B0F12',
  textMid: '#5B6570',
  textLow: '#97A0AA',
} as const;

export const colors = {
  bg: palette.ink900,
  bgDeep: palette.abyss,
  bgAlt: palette.ink800,
  surfaceAlt: palette.inset,
  surfaceSunken: palette.inset,
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
  onAccent: '#FFFFFF',
  onDark: palette.white,

  border: palette.hairline,
  borderStrong: palette.hairlineStrong,
} as const;

export type ThemeColors = typeof colors;
