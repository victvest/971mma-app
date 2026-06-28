import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? '971 MMA',
  slug: config.slug ?? '971-mma-app',
  orientation: 'portrait',
  plugins: [
    ...(config.plugins ?? []),
    'expo-font',
    'expo-image',
    'expo-image-picker',
    'expo-web-browser',
    'expo-video',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '971 MMA uses your location to verify you are at the academy when scanning the entrance QR code.',
      },
    ],
    [
      'expo-notifications',
      {
        defaultChannel: 'class-reminders',
        color: '#00843D',
      },
    ],
  ],

  ios: {
    ...config.ios,
    bundleIdentifier: config.ios?.bundleIdentifier ?? 'com.bahaa0541.ninemma',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription: '971 MMA uses the camera to scan check-in QR codes at the gym.',
      NSLocationWhenInUseUsageDescription:
        '971 MMA uses your location to verify you are at the academy when scanning the entrance QR code.',
      NSUserNotificationsUsageDescription:
        '971 MMA sends reminders for classes you subscribe to.',
      NSPhotoLibraryUsageDescription:
        '971 MMA uses your photo library so you can choose a profile picture.',
    },
  },
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.bahaa0541.ninemma',
    softwareKeyboardLayoutMode: 'resize',

    permissions: [
      ...new Set([
        ...(config.android?.permissions ?? []),
        'CAMERA',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
      ]),
    ],
  },

  extra: {
    ...config.extra,

    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

    MEMBER_PROVIDER: process.env.EXPO_PUBLIC_MEMBER_PROVIDER,
    CHECKIN_PROVIDER: process.env.EXPO_PUBLIC_CHECKIN_PROVIDER,

    COACH_DEMO_MODE: process.env.EXPO_PUBLIC_COACH_DEMO_MODE,
    DEV_GATE_LAT: process.env.EXPO_PUBLIC_DEV_GATE_LAT,
    DEV_GATE_LNG: process.env.EXPO_PUBLIC_DEV_GATE_LNG,
  },
});
