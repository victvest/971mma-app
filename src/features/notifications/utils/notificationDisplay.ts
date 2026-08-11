/**
 * Display helpers for notification rows — never show raw DB type codes as titles.
 */

const TYPE_TITLES: Record<string, string> = {
  announcement: 'Academy announcement',
  class_reminder: 'Class reminder',
  class_cancelled: 'Class cancelled',
  class_attendance: 'Class attendance',
  reward: 'Rewards update',
  redemption: 'Reward redeemed',
  milestone: 'Milestone unlocked',
  streak_warning: 'Streak reminder',
  belt: 'Belt progress',
  progression: 'Rank progress',
  promotion: 'Promotion',
  feed_like: 'New like',
  feed_comment: 'New comment',
  parent_child: 'Family update',
  guardian_alert: 'Guardian alert',
  community: 'Community update',
};

export function humanizeNotificationType(type: string): string {
  const key = type.trim().toLowerCase();
  if (TYPE_TITLES[key]) return TYPE_TITLES[key];

  const spaced = key.replace(/[_-]+/g, ' ').trim();
  if (!spaced) return 'Notification';
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function notificationDisplayTitle(
  type: string,
  payload: Record<string, unknown>,
): string {
  const title = payload.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return humanizeNotificationType(type);
}

export function notificationDisplayBody(payload: Record<string, unknown>): string | null {
  const body = payload.body;
  if (typeof body === 'string' && body.trim()) return body.trim();
  const message = payload.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return null;
}
