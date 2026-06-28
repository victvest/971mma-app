import type { NotificationItem } from '@/types/domain';

export type NotificationAction = {
  href: string;
  label: string;
};

function readPayloadId(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Maps in-app notification types/payloads to member routes.
 * Returns null when the notification should stay informational only.
 */
export function resolveNotificationAction(item: NotificationItem): NotificationAction | null {
  const type = item.type.trim().toLowerCase();
  const payload = item.payload;

  if (type === 'class_reminder' || type === 'class_cancelled') {
    const classId = readPayloadId(payload, ['classId', 'class_id', 'id']);
    if (classId) {
      return { href: `/classes/${classId}`, label: 'View class' };
    }
    return { href: '/(tabs)/schedule', label: 'View schedule' };
  }

  if (type === 'class_attendance') {
    return { href: '/attendance/class-sessions', label: 'View class attendance' };
  }

  if (type === 'class' || type.includes('class')) {
    const classId = readPayloadId(payload, ['classId', 'class_id', 'id']);
    if (classId) {
      return { href: `/classes/${classId}`, label: 'View class' };
    }
    return { href: '/(tabs)/schedule', label: 'View schedule' };
  }

  if (
    type === 'reward' ||
    type === 'redemption' ||
    type.includes('reward') ||
    type.includes('redemption')
  ) {
    return { href: '/(tabs)/rewards', label: 'View rewards' };
  }

  if (
    type === 'belt' ||
    type === 'progression' ||
    type === 'promotion' ||
    type === 'milestone' ||
    type.includes('belt') ||
    type.includes('progress')
  ) {
    return { href: '/(tabs)/belt-path', label: 'View belt path' };
  }

  return null;
}
