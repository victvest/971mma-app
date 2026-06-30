import type { NotificationItem } from '@/types/domain';
import {
  applyGuardianNotificationContext,
  guardianNotificationHref,
} from '@/features/guardian/utils/guardianNotificationNavigation';

export type NotificationAction = {
  href: string;
  label: string;
  beforeNavigate?: () => void;
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
    const referralId = readPayloadId(payload, ['referralId', 'referral_id']);
    if (referralId) {
      return { href: '/referrals', label: 'View referrals' };
    }
    return { href: '/(tabs)/rewards', label: 'View rewards' };
  }

  if (type === 'milestone') {
    const url = readPayloadId(payload, ['url']);
    return { href: url ?? '/(tabs)/rewards', label: 'View milestones' };
  }

  if (type === 'streak_warning' || type.includes('streak')) {
    const url = readPayloadId(payload, ['url']);
    return { href: url ?? '/(tabs)/rewards', label: 'View streak' };
  }

  if (
    type === 'belt' ||
    type === 'progression' ||
    type === 'promotion' ||
    type.includes('belt') ||
    type.includes('progress')
  ) {
    const url = readPayloadId(payload, ['url']);
    return { href: url ?? '/(tabs)/belt-path', label: 'View belt path' };
  }

  if (
    type === 'parent_child' ||
    type === 'guardian_alert' ||
    type.includes('guardian') ||
    type.includes('parent_child')
  ) {
    const href = guardianNotificationHref(payload) ?? '/family-trainees';
    return {
      href,
      label: 'View trainee',
      beforeNavigate: () => applyGuardianNotificationContext(payload),
    };
  }

  if (type === 'community' || type.includes('community')) {
    const postId = readPayloadId(payload, ['postId', 'post_id']);
    const channelId = readPayloadId(payload, ['channelId', 'channel_id']);
    const postKind = readPayloadId(payload, ['postKind', 'post_kind']);
    const titleLower = item.title.toLowerCase();
    const isAnnouncement =
      postKind === 'announcement' ||
      titleLower.includes('announcement') ||
      titleLower.includes('new announcement');

    if (postId) {
      return {
        href: `/communities/post/${postId}`,
        label: isAnnouncement ? 'View announcement' : 'View post',
      };
    }
    if (channelId) {
      return { href: `/communities/${channelId}`, label: 'View group' };
    }
    return { href: '/communities', label: 'View groups' };
  }

  return null;
}
