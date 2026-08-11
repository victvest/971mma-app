import type { ConfigContext, ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAndroidReleaseBuildProperties } = require('./eas/android.release.js');

/** Canonical App Store / Play Store ID — iOS bundle + Android package (must match). */
export const APP_BUNDLE_ID = 'com.victvest.ninemma';

/**
 * EAS cloud builds do not upload gitignored `.env`. Supabase URL/key must come from
 * EAS Environment Variables (project → Environment variables). Without them the APK
 * looks like it has "no internet" because every DB call fails at config time.
 */
function assertSupabaseEnvForEasBuild(): void {
  if (process.env.EAS_BUILD !== 'true') return;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anonKey) return;

  throw new Error(
    [
      'EAS build is missing EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      'Set them in Expo Dashboard → Project → Environment variables',
      `(environment: ${process.env.EAS_BUILD_PROFILE ?? 'unknown'}), then rebuild.`,
    ].join(' '),
  );
}

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc` */
function googleIosUrlSchemeFromEnv(): string | undefined {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClientId) return undefined;
  const match = /^([a-z0-9-]+)\.apps\.googleusercontent\.com$/i.exec(iosClientId);
  return match ? `com.googleusercontent.apps.${match[1]}` : undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertSupabaseEnvForEasBuild();

  const googleIosUrlScheme = googleIosUrlSchemeFromEnv();

  return {
    ...config,
    name: config.name ?? '971 MMA',
    slug: config.slug ?? '971-mma-app',
    orientation: 'portrait',
    icon: './assets/icon.png',
    // @ts-ignore
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: getAndroidReleaseBuildProperties(),
          // Google Sign-In → AppCheckCore 11.3+ breaks Expo static CocoaPods (RecaptchaInterop).
          // Pin until @react-native-google-signin/google-signin ships a fix.
          //
          // SDK 56 precompiled Expo modules can ship a broken module registry in local
          // Debug builds (null script URL / missing ExpoAsset). Build from source locally.
          ios: {
            extraPods: [{ name: 'AppCheckCore', version: '11.2.0' }],
            usePrecompiledModules: false,
          },
        },
      ],
      'expo-dev-client',
      'expo-font',
      'expo-image',
      [
        'expo-image-picker',
        {
          photosPermission:
            '971 MMA uses your photo library so you can choose a profile picture.',
          microphonePermission: false,
        },
      ],
      'expo-web-browser',
      'expo-apple-authentication',
      ...(googleIosUrlScheme
        ? [
            [
              '@react-native-google-signin/google-signin',
              { iosUrlScheme: googleIosUrlScheme },
            ] as [string, { iosUrlScheme: string }],
          ]
        : []),
      'expo-video',
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
      bundleIdentifier: APP_BUNDLE_ID,
      usesAppleSignIn: true,
      associatedDomains: [
        ...(config.ios?.associatedDomains ?? []),
        'applinks:app.971mma.com',
      ],
      config: {
        ...config.ios?.config,
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription:
          '971 MMA uses the camera so coaches can scan member QR passes for class attendance.',
        NSUserNotificationsUsageDescription:
          '971 MMA sends reminders for classes you subscribe to.',
        NSPhotoLibraryUsageDescription:
          '971 MMA uses your photo library so you can choose a profile picture.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...config.android,
      package: APP_BUNDLE_ID,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        ...(config.android?.adaptiveIcon ?? {}),
        backgroundColor: '#000000',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'app.971mma.com',
              pathPrefix: '/auth/callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],

      permissions: [
        ...new Set([
          ...(config.android?.permissions ?? []),
          'android.permission.INTERNET',
          'android.permission.ACCESS_NETWORK_STATE',
          'CAMERA',
          'POST_NOTIFICATIONS',
        ]),
      ],
      blockedPermissions: [
        ...new Set([
          ...(config.android?.blockedPermissions ?? []),
          'android.permission.RECORD_AUDIO',
          'android.permission.READ_MEDIA_IMAGES',
          'android.permission.READ_MEDIA_VIDEO',
          'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
          'android.permission.READ_EXTERNAL_STORAGE',
          'android.permission.WRITE_EXTERNAL_STORAGE',
          'android.permission.SYSTEM_ALERT_WINDOW',
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
      PERSONA_ASSISTANT_ENABLED: process.env.EXPO_PUBLIC_PERSONA_ASSISTANT_ENABLED,
      AUTH_CALLBACK_HOST: process.env.EXPO_PUBLIC_AUTH_CALLBACK_HOST,
      GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    },
  };
};
