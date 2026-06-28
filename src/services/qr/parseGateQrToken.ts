import { QR_PREFIX } from '@/services/qr/token';

export type ParsedGateQrToken = {
  locationId: string;
  exp: number;
  jti: string;
};

/**
 * Client-side format check for entrance display QR codes.
 * Signature verification happens server-side in entry-checkin only.
 *
 * Format: 971mma:v2:gate:<locationId>:<expEpoch>:<jti>:<HMAC>
 */
export function parseGateQrToken(raw: string): ParsedGateQrToken | null {
  if (!raw) return null;

  const parts = raw.trim().split(':');
  if (parts.length !== 7) return null;
  if (parts[0] !== QR_PREFIX || parts[1] !== 'v2' || parts[2] !== 'gate') return null;

  const [, , , locationId, expStr, jti] = parts;
  if (!locationId || !expStr || !jti) return null;

  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return null;

  return { locationId, exp, jti };
}

/** True when payload looks like a member pass (not an entrance display code). */
export function isMemberQrToken(raw: string): boolean {
  const parts = raw.trim().split(':');
  if (parts.length < 3 || parts[0] !== QR_PREFIX) return false;
  const source = parts[2];
  return source === 'supabase' || source === 'mindbody';
}
