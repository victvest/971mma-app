import { MbError } from './errors.ts';

const GATE_SOURCE = 'gate';
const TOKEN_VERSION = 'v2';
const QR_PREFIX = '971mma';

export type VerifiedGateToken = {
  locationId: string;
  jti: string;
  expEpoch: number;
};

function requireSecret(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new MbError('UPSTREAM_ERROR', `Gate signing not configured (${key}).`);
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

export function buildGateTokenPayload(
  locationId: string,
  expEpoch: number,
  jti: string,
): string {
  return `${GATE_SOURCE}:${locationId}:${expEpoch}:${jti}`;
}

export async function signGateToken(
  locationId: string,
  expEpoch: number,
  jti: string,
  secret = requireSecret('GATE_SIGNING_SECRET'),
): Promise<string> {
  const sigPayload = buildGateTokenPayload(locationId, expEpoch, jti);
  const sigBytes = await hmacSha256(secret, sigPayload);
  const sig = toBase64Url(sigBytes);
  return `${QR_PREFIX}:${TOKEN_VERSION}:${GATE_SOURCE}:${locationId}:${expEpoch}:${jti}:${sig}`;
}

export async function verifyGateToken(
  token: string,
  secret = requireSecret('GATE_SIGNING_SECRET'),
): Promise<VerifiedGateToken> {
  const parts = token.split(':');

  if (parts.length !== 7 || parts[0] !== QR_PREFIX || parts[1] !== TOKEN_VERSION) {
    throw new MbError('TOKEN_INVALID', 'Invalid token format.');
  }

  const [, , source, locationId, expStr, jti, sig] = parts;

  if (source !== GATE_SOURCE) {
    throw new MbError('TOKEN_INVALID', 'Not an entrance display token.');
  }
  if (!locationId || !expStr || !jti || !sig) {
    throw new MbError('TOKEN_INVALID', 'Malformed token fields.');
  }

  const expEpoch = parseInt(expStr, 10);
  if (!Number.isFinite(expEpoch)) throw new MbError('TOKEN_INVALID', 'Invalid token expiry.');
  if (expEpoch < Math.floor(Date.now() / 1000)) {
    throw new MbError('TOKEN_EXPIRED', 'Entrance QR has expired. Scan the live code on the display.');
  }

  const sigPayload = buildGateTokenPayload(locationId, expEpoch, jti);
  const expectedBytes = await hmacSha256(secret, sigPayload);
  const expected = toBase64Url(expectedBytes);

  if (!timingSafeEqual(expected, sig)) {
    throw new MbError('TOKEN_INVALID', 'Invalid token signature.');
  }

  return { locationId, jti, expEpoch };
}
