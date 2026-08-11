import type { RecordRollCallMarkInput } from '@/features/coach/roll-call/types';

export type RollCallQueuedMark = {
  clientGeneratedId: string;
  classId: string;
  mark: RecordRollCallMarkInput;
  enqueuedAt: string;
};

export function memberRefKey(mark: RecordRollCallMarkInput): string {
  if (mark.userId) return mark.userId;
  if (mark.mindbodyClientId) return `mb:${mark.mindbodyClientId}`;
  return 'unknown';
}
