/**
 * 971 MMA check-in QR token format.
 *
 * Token string layout (colon-delimited, URL-safe):
 *
 *     971mma:v1:<source>:<memberId>
 *
 *   - prefix    "971mma"           namespace, lets scanners ignore foreign codes
 *   - version   "v1"               schema version for forward-compat
 *   - source    "supabase" |       which system the memberId belongs to
 *               "mindbody"
 *   - memberId  <id>               Supabase profile uuid now; Mindbody client id later
 *
 * The token deliberately carries only a member identifier (no secrets). It
 * resolves to a Supabase profile today via SupabaseProvider.resolveMemberByQrToken,
 * and will resolve to a Mindbody client later via MindbodyProvider — without any
 * screen changes. See INTEGRATIONS.md for the full contract.
 */
import type { MemberRef } from '../types/models';

export const QR_PREFIX = '971mma';
export const QR_VERSION = 'v1';

export type QrSource = 'supabase' | 'mindbody';

export function buildMemberQrToken(memberId: string, source: QrSource = 'supabase'): string {
  return `${QR_PREFIX}:${QR_VERSION}:${source}:${memberId}`;
}

/** Parse a scanned token. Returns null if it isn't a recognized 971 token. */
export function parseMemberQrToken(raw: string): MemberRef | null {
  if (!raw) return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 4) return null;
  const [prefix, version, source, memberId] = parts;
  if (prefix !== QR_PREFIX) return null;
  if (version !== QR_VERSION) return null;
  if (source !== 'supabase' && source !== 'mindbody') return null;
  if (!memberId) return null;
  return { memberId, source };
}
