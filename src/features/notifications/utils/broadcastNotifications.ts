import type { AnnouncementItem, NotificationItem } from '@/types/domain';

export function isBroadcastNotification(item: NotificationItem): boolean {
  const type = item.type.trim().toLowerCase();
  const channel =
    typeof item.payload.channel === 'string' ? item.payload.channel.trim().toLowerCase() : '';

  return (
    type === 'announcement' ||
    type.includes('broadcast') ||
    channel === 'broadcast' ||
    channel.includes('broadcast')
  );
}

export function mapAnnouncementToNotification(announcement: AnnouncementItem): NotificationItem {
  return {
    id: `announcement-${announcement.id}`,
    type: 'announcement',
    title: announcement.title,
    body: announcement.body,
    payload: {
      announcementId: announcement.id,
      channel: announcement.channel,
      title: announcement.title,
      body: announcement.body,
    },
    readAt: null,
    createdAt: announcement.createdAt,
  };
}

export function isGuestAnnouncementNotification(item: NotificationItem): boolean {
  return item.id.startsWith('announcement-');
}
