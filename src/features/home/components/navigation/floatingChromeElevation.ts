import { type ViewStyle } from 'react-native';
import { layout } from '@/shared/theme/spacing';
import { lightColors } from '@/shared/theme/colors';
import { resolveChromeElevation } from '@/shared/theme/surfaceShadow';

/**
 * @deprecated Prefer `useTheme().chromeElevation()` so dark mode border color resolves correctly.
 * Kept for modules that cannot access theme hooks.
 */
export const FLOATING_CHROME_ELEVATION: ViewStyle = resolveChromeElevation(
  lightColors.border.subtle,
  layout.borderWidth,
);
