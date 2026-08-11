import { MbError } from './errors.ts';

const QR_PREFIX = '971mma';
const TOKEN_VERSION = 'v2';

export type MemberQrSource = 'supabase' | 'mindbody';

export type VerifiedMemberQrToken = {
  memberId: string;
  source: MemberQrSource;
  jti: string;
  expEpoch: number;
  sig?: string;
};

function requireSecret(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new MbError('UPSTREAM_ERROR', `QR signing not configured (${key}).`);
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function buildMemberQrTokenPayload(
  source: MemberQrSource,
  memberId: string,
  expEpoch: number,
  jti: string,
): string {
  return `${source}:${memberId}:${expEpoch}:${jti}`;
}

export async function signMemberQrToken(
  source: MemberQrSource,
  memberId: string,
  expEpoch: number,
  jti: string,
  secret = requireSecret('QR_SIGNING_SECRET'),
): Promise<string> {
  const sigPayload = buildMemberQrTokenPayload(source, memberId, expEpoch, jti);
  const sigBytes = await hmacSha256(secret, sigPayload);
  const sig = toBase64Url(sigBytes);
  return `${QR_PREFIX}:${TOKEN_VERSION}:${source}:${memberId}:${expEpoch}:${jti}:${sig}`;
}

export async function verifyMemberQrToken(
  token: string,
  secret = requireSecret('QR_SIGNING_SECRET'),
): Promise<VerifiedMemberQrToken> {
  const parts = token.split(':');

  if (parts.length !== 7 || parts[0] !== QR_PREFIX || parts[1] !== TOKEN_VERSION) {
    throw new MbError('TOKEN_INVALID', 'Invalid token format.');
  }

  const [, , source, memberId, expStr, jti, sig] = parts;

  if (source !== 'supabase' && source !== 'mindbody') {
    throw new MbError('TOKEN_INVALID', 'Invalid token source.');
  }
  if (!memberId || !expStr || !jti || !sig) {
    throw new MbError('TOKEN_INVALID', 'Malformed token fields.');
  }

  const expEpoch = parseInt(expStr, 10);
  if (!Number.isFinite(expEpoch)) throw new MbError('TOKEN_INVALID', 'Invalid token expiry.');

  if (expEpoch < Math.floor(Date.now() / 1000)) {
    throw new MbError('TOKEN_EXPIRED', 'QR code has expired.');
  }

  const sigPayload = buildMemberQrTokenPayload(source, memberId, expEpoch, jti);
  const expectedBytes = await hmacSha256(secret, sigPayload);
  const expected = toBase64Url(expectedBytes);

  if (!timingSafeEqual(expected, sig)) {
    throw new MbError('TOKEN_INVALID', 'Invalid token signature.');
  }

  return { memberId, source, jti, expEpoch, sig };
}
