import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { palette } from '../theme/colors';
import { fonts } from '../theme/fonts';

const fontConfig = configureFonts({
  config: {
    fontFamily: fonts.medium,
  },
});

/** React Native Paper theme mapped to 971 MMA design tokens. */
export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.green,
    onPrimary: palette.white,
    primaryContainer: palette.greenGlass,
    onPrimaryContainer: palette.greenDeep,
    secondary: palette.black,
    onSecondary: palette.white,
    secondaryContainer: palette.inset,
    onSecondaryContainer: palette.textHi,
    tertiary: palette.gold,
    onTertiary: palette.black,
    error: palette.red,
    onError: palette.white,
    errorContainer: palette.redGlass,
    onErrorContainer: palette.redDeep,
    background: palette.ink900,
    onBackground: palette.textHi,
    surface: palette.white,
    onSurface: palette.textHi,
    surfaceVariant: palette.ink600,
    onSurfaceVariant: palette.textMid,
    outline: palette.hairline,
    outlineVariant: palette.hairlineStrong,
    shadow: 'rgba(22,39,29,0.14)',
    scrim: 'rgba(11,15,18,0.4)',
    inverseSurface: palette.black,
    inverseOnSurface: palette.white,
    inversePrimary: palette.greenBright,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: palette.white,
      level2: palette.white,
      level3: palette.white,
      level4: palette.white,
      level5: palette.white,
    },
  },
};
