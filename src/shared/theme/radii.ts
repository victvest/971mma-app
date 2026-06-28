

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export type RadiiKey = keyof typeof radii;

export const radius = {

  pill: radii.full,

  button: radii.lg,

  input: radii.md,

  card: radii.xl,

  cardLarge: radii['2xl'],

  modal: radii['3xl'],

  avatar: radii.full,

  thumbnail: radii.md,

  badge: radii.full,

  tag: radii.sm,

  tabBar: radii['2xl'],
} as const;
