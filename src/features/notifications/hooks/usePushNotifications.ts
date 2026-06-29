import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { isStartupBackgroundWorkComplete } from '@/core/startup/startupBackgroundState';
import {
  applyGuardianNotificationContext,
  guardianNotificationHref,
} from '@/features/guardian/utils/guardianNotificationNavigation';
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

function notificationHref(data: Record<string, unknown>): string | null {
  const url = data.url;
  if (typeof url === 'string' && url.startsWith('/')) return url;

  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  if (type === 'parent_child' || type.includes('guardian')) {
    return guardianNotificationHref(data);
  }
  if (type === 'community' || type.includes('community')) {
    const postId = data.postId ?? data.post_id;
    const channelId = data.channelId ?? data.channel_id;
    if (typeof postId === 'string' && postId.trim()) {
      return `/communities/post/${postId.trim()}`;
    }
    if (typeof channelId === 'string' && channelId.trim()) {
      return `/communities/${channelId.trim()}`;
    }
    return '/communities';
  }

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
  const pushAvailable = isPushNotificationsAvailable();

  const handleResponse = useCallback((response: NotificationResponse | null) => {
    if (!response) return;

    const request = response.notification.request;
    if (handledResponseRef.current === request.identifier) return;
    handledResponseRef.current = request.identifier;

    const href = notificationHref(request.content.data ?? {});
    if (href) {
      const payload = request.content.data ?? {};
      const type = typeof payload.type === 'string' ? payload.type.toLowerCase() : '';
      if (type === 'parent_child' || type.includes('guardian')) {
        applyGuardianNotificationContext(payload);
      }
      router.push(href);
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
