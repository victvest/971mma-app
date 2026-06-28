
const palette = {

  // UAE flag / Emirates brand green (Pantone 348 / #00843D)
  green500: '#00843D',
  green600: '#006B32',
  green700: '#005427',
  green50: '#E8F5EE',
  green100: '#C8E6C9',
  green900bg: '#0A2E1A',

  red500: '#E8192C',
  red50: '#FDEAEC',
  red100: '#FFCDD2',
  red700: '#D32F2F',
  red900bg: '#2E0A0F',

  amber400: '#F5A623',
  amber50: '#FFF3E0',
  amberBorder: '#FFE0B2',
  amber900bg: '#2E1C00',

  white: '#FFFFFF',
  /** Screen canvas in light mode — pure white per client requirement */
  screenWhite: '#FFFFFF',
  /** Subtle contrast surface on white screens (cards, fields, chips) */
  surfaceTint: '#F5F5F5',
  warmWhite: '#F5F4F0',
  warmGray100: '#EDECE8',
  warmGray200: '#DEDDD9',
  warmGray400: '#B0AFAA',
  warmGray500: '#8A8A86',
  warmGray600: '#5A5A56',
  warmGray700: '#3A3A36',
  nearBlack: '#0F0F0E',

  /** Dark feature cards (belt path, points balance) — same in light/dark themes */
  promoBg: '#0A1310',
  promoMuted: '#8A928F',
  promoLabelMuted: '#5A6260',
  promoBorder: 'rgba(255,255,255,0.06)',
  promoTrack: '#1E2522',
  promoRingTrack: 'rgba(255,255,255,0.08)',

  dark50: '#F0F0ED',
  dark100: '#A0A09C',
  dark300: '#6A6A66',
  dark600: '#3E3E3A',
  dark700: '#2E2E2A',
  dark800: '#242420',
  dark900: '#191916',
  dark950: '#0F0F0C',
  black: '#0C0C0C',
} as const;

export type AppColors = {
  background: {
    primary: string;
    secondary: string;
    elevated: string;
    overlay: string;
    inverse: string;
  };
  surface: {
    primary: string;
    secondary: string;
    tertiary: string;
    promo: string;
    promoTrack: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    onAccent: string;
    onPromo: string;
    onPromoMuted: string;
    onPromoLabel: string;
  };
  accent: {
    default: string;
    pressed: string;
    subtle: string;
    onAccent: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    onPromo: string;
    promoRing: string;
  };
  fill: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  status: {
    success: string;
    successSubtle: string;
    successBorder: string;
    warning: string;
    warningSubtle: string;
    warningBorder: string;
    error: string;
    errorSubtle: string;
    errorBorder: string;
    errorEmphasis: string;
    live: string;
  };
  media: {
    scrimTop: string;
    scrimMiddle: string;
    scrimBottom: string;
  };
};

export const lightColors: AppColors = {
  background: {
    primary: palette.screenWhite,
    secondary: palette.surfaceTint,
    elevated: palette.white,
    overlay: 'rgba(0,0,0,0.45)',
    inverse: palette.nearBlack,
  },
  surface: {
    primary: palette.white,
    secondary: palette.surfaceTint,
    tertiary: palette.warmGray100,
    promo: palette.promoBg,
    promoTrack: palette.promoTrack,
  },
  text: {
    primary: palette.nearBlack,
    secondary: palette.warmGray600,
    tertiary: palette.warmGray500,
    inverse: palette.white,
    onAccent: palette.white,
    onPromo: palette.white,
    onPromoMuted: palette.promoMuted,
    onPromoLabel: palette.promoLabelMuted,
  },
  accent: {
    default: palette.green500,
    pressed: palette.green600,
    subtle: palette.green50,
    onAccent: palette.white,
  },
  border: {
    subtle: '#EBEBEB',
    default: palette.warmGray200,
    strong: palette.warmGray400,
    onPromo: palette.promoBorder,
    promoRing: palette.promoRingTrack,
  },
  fill: {
    primary: palette.nearBlack,
    secondary: '#EBEBEB',
    tertiary: palette.surfaceTint,
  },
  status: {
    success: palette.green500,
    successSubtle: palette.green50,
    successBorder: palette.green100,
    warning: palette.amber400,
    warningSubtle: palette.amber50,
    warningBorder: palette.amberBorder,
    error: palette.red500,
    errorSubtle: palette.red50,
    errorBorder: palette.red100,
    errorEmphasis: palette.red700,
    live: palette.red500,
  },
  media: {
    scrimTop: 'rgba(0,0,0,0.02)',
    scrimMiddle: 'rgba(0,0,0,0.18)',
    scrimBottom: 'rgba(0,0,0,0.76)',
  },
};

export const darkColors: AppColors = {
  background: {
    primary: palette.black,
    secondary: palette.dark950,
    elevated: palette.dark900,
    overlay: 'rgba(0,0,0,0.7)',
    inverse: palette.nearBlack,
  },
  surface: {
    primary: palette.dark900,
    secondary: palette.dark950,
    tertiary: '#111110',
    promo: palette.promoBg,
    promoTrack: palette.promoTrack,
  },
  text: {
    primary: palette.dark50,
    secondary: palette.dark100,
    tertiary: palette.dark300,
    inverse: palette.nearBlack,
    onAccent: palette.white,
    onPromo: palette.white,
    onPromoMuted: palette.promoMuted,
    onPromoLabel: palette.promoLabelMuted,
  },
  accent: {
    default: palette.green500,
    pressed: palette.green600,
    subtle: palette.green900bg,
    onAccent: palette.white,
  },
  border: {
    subtle: palette.dark800,
    default: palette.dark700,
    strong: palette.dark600,
    onPromo: palette.promoBorder,
    promoRing: palette.promoRingTrack,
  },
  fill: {
    primary: palette.dark50,
    secondary: '#2A2A26',
    tertiary: '#1A1A16',
  },
  status: {
    success: palette.green500,
    successSubtle: palette.green900bg,
    successBorder: palette.green700,
    warning: palette.amber400,
    warningSubtle: palette.amber900bg,
    warningBorder: palette.amberBorder,
    error: palette.red500,
    errorSubtle: palette.red900bg,
    errorBorder: palette.red700,
    errorEmphasis: palette.red500,
    live: palette.red500,
  },
  media: {
    scrimTop: 'rgba(0,0,0,0.08)',
    scrimMiddle: 'rgba(0,0,0,0.32)',
    scrimBottom: 'rgba(0,0,0,0.82)',
  },
};
