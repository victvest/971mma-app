import type { MemberRef } from '@/types/domain';

export const QR_PREFIX = '971mma';
export const QR_VERSION = 'v1';

export type QrSource = 'supabase' | 'mindbody';

export type ParsedQrToken = MemberRef & { exp?: number };

export function buildMemberQrToken(memberId: string, source: QrSource = 'supabase'): string {
  return `${QR_PREFIX}:${QR_VERSION}:${source}:${memberId}`;
}

export function parseMemberQrToken(raw: string): ParsedQrToken | null {
  if (!raw) return null;
  const parts = raw.trim().split(':');
  if (parts.length < 2 || parts[0] !== QR_PREFIX) return null;
  const version = parts[1];

  if (version === 'v1') {
    if (parts.length !== 4) return null;
    const [, , source, memberId] = parts;
    if (source !== 'supabase' && source !== 'mindbody') return null;
    if (!memberId) return null;
    return { memberId, source };
  }

  if (version === 'v2') {

    if (parts.length !== 7) return null;
    const [, , source, memberId, expStr] = parts;
    if (source !== 'supabase' && source !== 'mindbody') return null;
    if (!memberId || !expStr) return null;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp)) return null;
    return { memberId, source, exp };
  }

  return null;
}
