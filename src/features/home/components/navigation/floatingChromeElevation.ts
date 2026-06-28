import { Platform, type ViewStyle } from 'react-native';

/** Subtle lift for floating liquid-glass chrome on light backgrounds. */
export const FLOATING_CHROME_ELEVATION: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0F0F0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  android: {
    elevation: 8,
  },
  default: {},
}) ?? {};
