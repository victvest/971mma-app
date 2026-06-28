/** Academy announcement channels — configured list for coach/admin posts. */
export const ANNOUNCEMENT_CHANNELS = [
  { id: 'general', label: 'General' },
  { id: 'bjj', label: 'BJJ' },
  { id: 'muay thai', label: 'Muay Thai' },
  { id: 'all members', label: 'All members' },
] as const;

export type AnnouncementChannelId = (typeof ANNOUNCEMENT_CHANNELS)[number]['id'];

export const DEFAULT_ANNOUNCEMENT_CHANNEL: AnnouncementChannelId = 'general';

export function isAnnouncementChannelId(value: string): value is AnnouncementChannelId {
  return ANNOUNCEMENT_CHANNELS.some((channel) => channel.id === value);
}
