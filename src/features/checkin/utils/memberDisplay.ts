import type { BeltPathSummary, MemberProfile } from '@/types/domain';

export function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatBirthDate(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const parts = iso.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;

  const [year, month, day] = parts;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function buildBeltLine(
  beltPath: BeltPathSummary | undefined,
  profile: MemberProfile | null | undefined,
): string {
  const rankName = beltPath?.progress.rankName ?? profile?.beltRank ?? 'White';
  const stripe = beltPath?.progress.stripe ?? profile?.beltStripes ?? 0;
  const since = formatMemberSince(profile?.memberSince);

  const rankLabel = /belt/i.test(rankName) ? rankName : `${rankName} belt`;
  const stripeLabel = `stripe ${stripe}`;
  if (since) return `${rankLabel} · ${stripeLabel} · since ${since}`;
  return `${rankLabel} · ${stripeLabel}`;
}
