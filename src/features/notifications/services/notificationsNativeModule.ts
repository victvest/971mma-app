import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

export function isPushNotificationsAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  // expo-notifications throws on import in Expo Go on Android (SDK 53+).
  if (Platform.OS === 'android' && isRunningInExpoGo()) return false;
  return true;
}

export function getNotificationsModule(): NotificationsModule | null {
  if (!isPushNotificationsAvailable()) return null;

  if (cachedModule === undefined) {
    try {
      cachedModule = require('expo-notifications') as NotificationsModule;
    } catch {
      cachedModule = null;
    }
  }

  return cachedModule;
}

export function ensureNotificationHandlerConfigured(): void {
  const Notifications = getNotificationsModule();
  if (!Notifications || handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}
