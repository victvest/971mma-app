import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

const generalSansAssets = {
  'GeneralSans-Regular': require('../../../assets/fonts/general-sans/GeneralSans-Regular.otf'),
  'GeneralSans-Medium': require('../../../assets/fonts/general-sans/GeneralSans-Medium.otf'),
  'GeneralSans-Semibold': require('../../../assets/fonts/general-sans/GeneralSans-Semibold.otf'),
  'GeneralSans-Bold': require('../../../assets/fonts/general-sans/GeneralSans-Bold.otf'),
} as const;

const interAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} as const;

export const appFontMap = {
  ...generalSansAssets,
  ...interAssets,
} as const;

export function useAppFonts() {
  return useFonts(appFontMap);
}
