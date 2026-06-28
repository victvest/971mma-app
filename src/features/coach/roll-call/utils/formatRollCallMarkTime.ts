import { GYM_TIME_ZONE } from '@/core/time/gymTime';

export function formatRollCallMarkTime(markedAt: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: GYM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(markedAt));
}
