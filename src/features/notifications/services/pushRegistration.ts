import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { toUserFacingErrorMessage, USER_FACING_CONFIG_ERROR } from '@/lib/userFacingError';
import { getSupabaseClient } from '@/services/supabase/client';
import { getNotificationsModule, isPushNotificationsAvailable } from './notificationsNativeModule';

type NotificationsModule = typeof import('expo-notifications');
type NotificationPermissionsStatus = Awaited<
  ReturnType<NotificationsModule['getPermissionsAsync']>
>;

const CLASS_REMINDER_CHANNEL_ID = 'class-reminders';
const ANDROID_NOTIFICATION_CHANNELS = [
  { id: 'academy-updates', name: 'Academy updates', importance: 'default' as const },
  { id: CLASS_REMINDER_CHANNEL_ID, name: 'Class reminders', importance: 'high' as const },
  { id: 'progress-updates', name: 'Progress updates', importance: 'default' as const },
  { id: 'rewards-updates', name: 'Rewards updates', importance: 'default' as const },
  { id: 'family-updates', name: 'Family updates', importance: 'high' as const },
  { id: 'community-updates', name: 'Community updates', importance: 'default' as const },
];

type PushPlatform = 'ios' | 'android' | 'web';

export type PushRegistrationResult = {
  token: string | null;
  status: 'registered' | 'denied' | 'unavailable' | 'skipped';
  message?: string;
};

type RegisterPushOptions = {
  requestPermission?: boolean;
};

type ExpoConfigExtra = {
  eas?: {
    projectId?: string;
  };
};

function pushPlatform(): PushPlatform | null {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return null;
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Promise.all(
    ANDROID_NOTIFICATION_CHANNELS.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance:
          channel.importance === 'high'
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: channel.importance === 'high' ? [0, 250, 250, 250] : [0, 150],
        lightColor: '#00843D',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }),
    ),
  );
}

function permissionGranted(
  Notifications: NotificationsModule,
  status: NotificationPermissionsStatus,
): boolean {
  if (status.granted || status.status === 'granted') return true;

  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function readProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as ExpoConfigExtra | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function registerForPushNotifications(
  options: RegisterPushOptions = {},
): Promise<PushRegistrationResult> {
  const platform = pushPlatform();
  if (!platform || platform === 'web') {
    return {
      token: null,
      status: 'skipped',
      message: 'Push notifications are available in the iOS and Android app.',
    };
  }

  if (!isPushNotificationsAvailable()) {
    return {
      token: null,
      status: 'skipped',
      message: 'Push notifications require a development or production build on Android.',
    };
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return {
      token: null,
      status: 'unavailable',
      message: 'Push notifications are unavailable in this environment.',
    };
  }

  try {
    await ensureAndroidChannel(Notifications);

    let permission = await Notifications.getPermissionsAsync();
    if (!permissionGranted(Notifications, permission) && options.requestPermission === true) {
      permission = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }

    if (!permissionGranted(Notifications, permission)) {
      return {
        token: null,
        status: 'denied',
        message: 'Notification permission is not enabled.',
      };
    }

    const projectId = readProjectId();
    if (!projectId) {
      return {
        token: null,
        status: 'unavailable',
        message: USER_FACING_CONFIG_ERROR,
      };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await getSupabaseClient().rpc('upsert_push_token', {
      p_token: token,
      p_platform: platform,
      p_device_id: null,
    });

    if (error) {
      return {
        token: null,
        status: 'unavailable',
        message: toUserFacingErrorMessage(error, {
          fallback: 'Push registration failed.',
        }),
      };
    }

    return { token, status: 'registered' };
  } catch (error) {
    const message = toUserFacingErrorMessage(error, {
      fallback: 'Push registration failed.',
    });
    return { token: null, status: 'unavailable', message };
  }
}

export async function unregisterPushToken(): Promise<void> {
  const platform = pushPlatform();
  if (!platform || platform === 'web' || !isPushNotificationsAvailable()) return;

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  const projectId = readProjectId();
  if (!projectId) return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token) {
      await getSupabaseClient().rpc('remove_push_token', { p_token: token });
    }
  } catch {
    // Graceful no-op on logout network or token resolution failure
  }
}

