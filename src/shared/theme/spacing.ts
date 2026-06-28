export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

export type SpacingKey = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingKey];

export const inset = {
  '2xs': spacing[1],

  xs: spacing[2],

  sm: spacing[3],

  md: spacing[4],

  lg: spacing[5],

  xl: spacing[6],

  '2xl': spacing[8],

  '3xl': spacing[12],
} as const;

export const gap = {
  xs: spacing[1],

  sm: spacing[2],

  md: spacing[3],

  lg: spacing[4],

  xl: spacing[6],

  '2xl': spacing[8],
} as const;

export const layout = {
  screenPaddingH: spacing[5],

  screenPaddingTop: spacing[4],

  safeBottom: spacing[8],

  headerHeight: 56,

  tabBarHeight: 80,

  authContentMaxWidth: 520,

  authWideBreakpoint: 700,

  authCompactHeight: 700,

  authBrandMark: spacing[20],

  authFieldHeight: spacing[14],

  authButtonHeight: spacing[14],

  authEntranceOffset: spacing[6],

  authIntroMediaFlex: 64,

  authIntroPanelFlex: 36,

  authIntroLogoSize: spacing[16],

  authIntroSloganSpacing: spacing[10],

  authIntroActionsSpacing: spacing[12],

  appHeaderHeight: 58,

  appHeaderIconTouch: 58,

  appHeaderAvatar: 48,

  appHeaderHorizontalInset: spacing[4],

  appHeaderTopInset: spacing[2],

  academyFlagWidth: spacing[7],

  academyFlagHeight: spacing[4],

  coachFeatureHeroRatio: 0.68,

  coachFeatureHeroMinHeight: spacing[32] + spacing[20],

  coachDetailHeroRatio: 0.46,

  coachDetailHeroMinHeight: spacing[32] + spacing[32] + spacing[16],

  coachDetailHeroMaxHeight: spacing[32] + spacing[32] + spacing[32] + spacing[20],

  coachAvatarLarge: spacing[16],

  coachAvatarSmall: spacing[12],

  coachAvatarBorder: spacing[1],

  coachCardImageRatio: 0.56,

  coachSectionTopGap: spacing[6],

  coachSectionTitleBottomGap: spacing[3],

  coachClassTimeBox: spacing[16],

  coachActionHeight: spacing[14] + spacing[2],

  coachBackButton: spacing[14],

  tabBarActiveInset: spacing[2],

  tabIconSize: spacing[6],

  glassNavIntensity: 95,

  glassDrawerIntensity: 100,

  glassHeaderIntensity: 95,

  drawerLogoWidthRatio: 0.3,

  borderWidth: 1,

  borderWidthStrong: 1.5,
} as const;
