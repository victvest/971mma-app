/**
 * Default surfaces stay flat (border + contrast).
 * Card / media / nav tokens add depth only where blur or dark chrome needs separation.
 */
type ShadowToken = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

const zeroShadow: ShadowToken = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

export const shadows = {
  none: zeroShadow,
  xs: zeroShadow,
  sm: zeroShadow,
  md: zeroShadow,
  lg: zeroShadow,
  xl: zeroShadow,
  accent: zeroShadow,
  /** Light cards on white app background — subtle lift */
  card: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** Dark command cards (belt path, promo) */
  cardDark: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  /** Full-bleed media hero */
  mediaHero: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  /** Soft clay lift for premium stat cards */
  clay: {
    shadowColor: '#1A2E24',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  /** Inner recessed well (simulated via companion border styles) */
  clayInset: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export type ShadowKey = keyof typeof shadows;
