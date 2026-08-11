export function formatFeedBeltLine(
  beltRank: string | null | undefined,
  beltStripes: number | null | undefined,
): string | null {
  if (!beltRank?.trim()) return null;

  const stripes = beltStripes ?? 0;
  const rankLabel = /belt/i.test(beltRank) ? beltRank.trim() : `${beltRank.trim()} Belt`;

  if (stripes <= 0) return rankLabel;

  const stripeLabel = stripes === 1 ? '1 stripe' : `${stripes} stripes`;
  return `${rankLabel} · ${stripeLabel}`;
}

export function formatFeedMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;

  try {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 45) return 'Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function coerceNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function coerceString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
