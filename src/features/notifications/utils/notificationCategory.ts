import type { NotificationItem } from '@/types/domain';

export type NotificationCategory =
  | 'announcement'
  | 'milestone'
  | 'reminder'
  | 'reward'
  | 'other';

export type NotificationFilterId =
  | 'all'
  | 'announcement'
  | 'milestone'
  | 'reminder'
  | 'reward';

export type NotificationChipMetrics = {
  counts: Record<NotificationFilterId, number>;
  hasUnread: Record<NotificationFilterId, boolean>;
  unreadCount: number;
};

export function getNotificationCategory(item: NotificationItem): NotificationCategory {
  const t = item.type.toLowerCase();
  const title = (item.title || '').toLowerCase();

  if (t === 'announcement' || t.includes('announcement') || title.includes('announcement')) {
    return 'announcement';
  }
  if (
    t === 'promotion' ||
    t === 'belt' ||
    t === 'milestone' ||
    t.includes('belt') ||
    title.includes('belt') ||
    title.includes('promotion')
  ) {
    return 'milestone';
  }
  if (
    title.includes('streak') ||
    title.includes('come-back') ||
    title.includes('reminder') ||
    t.includes('reminder') ||
    title.includes('protect')
  ) {
    return 'reminder';
  }
  if (
    t.includes('reward') ||
    t.includes('point') ||
    t.includes('redemption') ||
    title.includes('reward') ||
    title.includes('points') ||
    title.includes('redeem')
  ) {
    return 'reward';
  }
  return 'other';
}

export function matchesNotificationFilter(
  item: NotificationItem,
  filter: NotificationFilterId,
): boolean {
  if (filter === 'all') return true;

  const category = getNotificationCategory(item);
  if (filter === 'reminder') {
    return (
      category === 'reminder' ||
      category === 'other' ||
      item.type.toLowerCase().includes('class')
    );
  }

  return category === filter;
}

export function computeNotificationChipMetrics(
  items: NotificationItem[],
): NotificationChipMetrics {
  const counts: NotificationChipMetrics['counts'] = {
    all: items.length,
    announcement: 0,
    milestone: 0,
    reminder: 0,
    reward: 0,
  };
  const hasUnread: NotificationChipMetrics['hasUnread'] = {
    all: false,
    announcement: false,
    milestone: false,
    reminder: false,
    reward: false,
  };
  let unreadCount = 0;

  for (const item of items) {
    const category = getNotificationCategory(item);
    const unread = !item.readAt;
    const typeLower = item.type.toLowerCase();
    const inReminderFilter =
      category === 'reminder' || category === 'other' || typeLower.includes('class');

    if (category === 'announcement') counts.announcement += 1;
    if (category === 'milestone') counts.milestone += 1;
    if (category === 'reward') counts.reward += 1;
    if (inReminderFilter) counts.reminder += 1;

    if (unread) {
      unreadCount += 1;
      hasUnread.all = true;
      if (category === 'announcement') hasUnread.announcement = true;
      if (category === 'milestone') hasUnread.milestone = true;
      if (category === 'reward') hasUnread.reward = true;
      if (inReminderFilter) hasUnread.reminder = true;
    }
  }

  return { counts, hasUnread, unreadCount };
}
