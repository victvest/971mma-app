import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { isStartupBackgroundWorkComplete } from '@/core/startup/startupBackgroundState';
import {
  registerForPushNotifications,
  type PushRegistrationResult,
} from '../services/pushRegistration';

export type { PushRegistrationResult } from '../services/pushRegistration';
export { registerForPushNotifications } from '../services/pushRegistration';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function notificationHref(data: Record<string, unknown>): string | null {
  const url = data.url;
  if (typeof url === 'string' && url.startsWith('/')) return url;

  const type = typeof data.type === 'string' ? data.type : '';
  const classId = data.classId ?? data.class_id;
  if (
    (type === 'class_reminder' || type === 'class_cancelled') &&
    typeof classId === 'string' &&
    classId.trim()
  ) {
    return `/classes/${classId.trim()}`;
  }

  return null;
}

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const handledResponseRef = useRef<string | null>(null);

  const handleResponse = useCallback((response: Notifications.NotificationResponse | null) => {
    if (!response) return;

    const request = response.notification.request;
    if (handledResponseRef.current === request.identifier) return;
    handledResponseRef.current = request.identifier;

    const href = notificationHref(request.content.data ?? {});
    if (href) {
      router.push(href);
    }
  }, []);

  useEffect(() => {
    handleResponse(Notifications.getLastNotificationResponse());

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => {
      subscription.remove();
    };
  }, [handleResponse]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!isStartupBackgroundWorkComplete(userId)) return;
      void registerForPushNotifications({ requestPermission: false });
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, userId]);

  return { registerForPushNotifications };
}
