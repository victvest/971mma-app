const GYM_TIME_ZONE = 'Asia/Dubai';

export const COMMUNITY_CHAT_BUBBLE = {
  coach: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  member: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
} as const;

export function formatCommunityMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(value);

  if (dayKey(date) === dayKey(now)) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: GYM_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: GYM_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatCommunityDateSeparator(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(value);

  if (dayKey(date) === dayKey(now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function buildCommunityPreview(title: string | null, body: string, maxLength = 120): string {
  const source = title?.trim() || body.trim();
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength - 1).trim()}…`;
}

export function formatCommunityInboxTime(iso: string | null): string {
  if (!iso) return '';
  return formatCommunityMessageTime(iso);
}

export function sameCommunityDay(leftIso: string, rightIso: string): boolean {
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(new Date(iso));

  return dayKey(leftIso) === dayKey(rightIso);
}
