import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';
import { palette } from './src/theme/colors';

/**
 * 971 MMA Tamagui config — brand theme on v5 preset.
 * Drop handoff zip into `assets/design/` to regenerate tokens from source.
 */
export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    radius: {
      ...defaultConfig.tokens.radius,
      sm: 12,
      md: 16,
      lg: 22,
      xl: 28,
      xxl: 34,
      pill: 999,
    },
    space: {
      ...defaultConfig.tokens.space,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      7: 32,
      8: 48,
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: palette.ink900,
      backgroundHover: palette.ink800,
      backgroundPress: palette.inset,
      color: palette.textHi,
      colorHover: palette.textHi,
      colorPress: palette.textMid,
      borderColor: palette.hairline,
      borderColorHover: palette.hairlineStrong,
      placeholderColor: palette.textLow,
      shadowColor: 'rgba(22,39,29,0.12)',
      accentBackground: palette.green,
      accentColor: palette.white,
      brandGreen: palette.green,
      brandRed: palette.red,
      brandGold: palette.gold,
      textHi: palette.textHi,
      textMid: palette.textMid,
      textLow: palette.textLow,
      surface: palette.white,
      ink: palette.black,
    },
  },
  fonts: {
    ...defaultConfig.fonts,
    body: {
      ...defaultConfig.fonts.body,
      family: 'Inter_500Medium',
      face: {
        400: { normal: 'Inter_400Regular' },
        500: { normal: 'Inter_500Medium' },
        600: { normal: 'Inter_600SemiBold' },
        700: { normal: 'Inter_700Bold' },
        800: { normal: 'Inter_800ExtraBold' },
      },
    },
    heading: {
      ...defaultConfig.fonts.heading,
      family: 'BarlowCondensed_800ExtraBold',
      face: {
        500: { normal: 'BarlowCondensed_500Medium' },
        600: { normal: 'BarlowCondensed_600SemiBold' },
        700: { normal: 'BarlowCondensed_700Bold' },
        800: { normal: 'BarlowCondensed_800ExtraBold' },
      },
    },
  },
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
