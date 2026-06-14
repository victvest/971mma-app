/**
 * Typography families for the premium 971 MMA experience.
 *
 * Barlow Condensed → athletic, condensed display type (hero titles, big numbers).
 * Inter → clean, highly legible UI/body type (labels, paragraphs, metadata).
 *
 * The keys below are the exact font names registered via `useFonts` in App.tsx.
 */
import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export const fontAssets = {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

export const fonts = {
  // Display (Barlow Condensed)
  displayBlack: 'BarlowCondensed_800ExtraBold',
  displayBold: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  displayMedium: 'BarlowCondensed_500Medium',
  // UI / body (Inter)
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
  semi: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
} as const;
