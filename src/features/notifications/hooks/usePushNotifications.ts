import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { isStartupBackgroundWorkComplete } from '@/core/startup/startupBackgroundState';
import { resolvePushNotificationNavigation } from '@/features/notifications/resolveNotificationAction';
import {
  registerForPushNotifications,
  type PushRegistrationResult,
} from '../services/pushRegistration';
import {
  ensureNotificationHandlerConfigured,
  getNotificationsModule,
  isPushNotificationsAvailable,
} from '../services/notificationsNativeModule';

export type { PushRegistrationResult } from '../services/pushRegistration';
export { registerForPushNotifications } from '../services/pushRegistration';

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const handledResponseRef = useRef<string | null>(null);
  const pushAvailable = isPushNotificationsAvailable();

  const handleResponse = useCallback((response: NotificationResponse | null) => {
    if (!response) return;

    const request = response.notification.request;
    if (handledResponseRef.current === request.identifier) return;
    handledResponseRef.current = request.identifier;

    const nav = resolvePushNotificationNavigation(request.content.data ?? {});
    if (nav) {
      nav.beforeNavigate?.();
      router.push(nav.href);
    }
  }, []);

  useEffect(() => {
    if (!pushAvailable) return undefined;

    const Notifications = getNotificationsModule();
    if (!Notifications) return undefined;

    ensureNotificationHandlerConfigured();
    handleResponse(Notifications.getLastNotificationResponse());

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => {
      subscription.remove();
    };
  }, [handleResponse, pushAvailable]);

  useEffect(() => {
    if (!pushAvailable || !isAuthenticated || !userId) return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!isStartupBackgroundWorkComplete(userId)) return;
      void registerForPushNotifications({ requestPermission: false });
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, pushAvailable, userId]);

  return { registerForPushNotifications };
}
