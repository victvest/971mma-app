import type { Href } from 'expo-router';
import {
  applyGuardianNotificationContext,
  guardianNotificationHref,
} from '@/features/guardian/utils/guardianNotificationNavigation';
import type { NotificationItem } from '@/types/domain';

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

type ResolveOptions = {
  /** Used for community announcement heuristics (in-app inbox). */
  title?: string;
};

/**
 * Shared routing for in-app inbox taps and push notification responses.
 * Keep one map so push and inbox never diverge.
 */
export function resolveNotificationActionFromPayload(
  typeRaw: string,
  payload: Record<string, unknown>,
  options: ResolveOptions = {},
): NotificationAction | null {
  const type = typeRaw.trim().toLowerCase();
  const titleLower = (options.title ?? '').toLowerCase();
  const url = readPayloadId(payload, ['url']);

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

  if (type === 'feed_like' || type === 'feed_comment' || type.includes('feed')) {
    if (url?.startsWith('/feed/')) {
      return { href: url, label: 'View post' };
    }
    const postId = readPayloadId(payload, ['postId', 'post_id', 'id']);
    if (postId) {
      return { href: `/feed/post/${postId}`, label: 'View post' };
    }
    return { href: '/(tabs)/feed', label: 'View feed' };
  }

  if (type === 'milestone') {
    return { href: url ?? '/(tabs)/rewards', label: 'View milestones' };
  }

  if (type === 'streak_warning' || type.includes('streak')) {
    return { href: url ?? '/(tabs)/rewards', label: 'View streak' };
  }

  if (
    type === 'belt' ||
    type === 'progression' ||
    type === 'promotion' ||
    type.includes('belt') ||
    type.includes('progress')
  ) {
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
    const isAnnouncement =
      postKind === 'announcement' ||
      titleLower.includes('announcement') ||
      titleLower.includes('new announcement');

    if (channelId) {
      return {
        href: `/communities/${channelId}`,
        label: isAnnouncement ? 'View announcement' : 'View group',
      };
    }
    if (postId) {
      return { href: `/communities/post/${postId}`, label: 'View post' };
    }
    return { href: '/communities', label: 'View groups' };
  }

  // Explicit deep link last — typed routes above win for known domains.
  if (url?.startsWith('/') && !url.startsWith('//')) {
    return { href: url, label: 'Open' };
  }

  return null;
}

/**
 * Maps in-app notification types/payloads to member routes.
 * Returns null when the notification should stay informational only.
 */
export function resolveNotificationAction(item: NotificationItem): NotificationAction | null {
  return resolveNotificationActionFromPayload(item.type, item.payload, { title: item.title });
}

/** Push / Expo response → Expo Router href (+ optional side effects). */
export function resolvePushNotificationNavigation(
  data: Record<string, unknown>,
): { href: Href; beforeNavigate?: () => void } | null {
  const type = typeof data.type === 'string' ? data.type : '';
  const title = typeof data.title === 'string' ? data.title : undefined;
  const action = resolveNotificationActionFromPayload(type, data, { title });
  if (!action) return null;
  return { href: action.href as Href, beforeNavigate: action.beforeNavigate };
}
