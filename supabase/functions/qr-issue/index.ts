import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

type QrIssueRequest = {
  targetUserId?: string;
};

const TOKEN_TTL_SECONDS = 90;

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

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const { userId: callerUserId } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as QrIssueRequest;
    const svc = serviceClient();
    const secret = requireSecret('QR_SIGNING_SECRET');
    const targetUserId = await resolveTargetUserId(svc, callerUserId, body.targetUserId, {
      requireGuardianQrPermission: true,
    });

    const jti = crypto.randomUUID();
    const expEpoch = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const expiresAt = new Date(expEpoch * 1000).toISOString();

    const { error: insertError } = await svc.from('qr_tokens').insert({
      user_id: targetUserId,
      jti,
      expires_at: expiresAt,
      issued_by_user_id: targetUserId === callerUserId ? null : callerUserId,
    });
    if (insertError) throw new MbError('UPSTREAM_ERROR', 'Unable to persist QR token.');

    const sigPayload = `supabase:${targetUserId}:${expEpoch}:${jti}`;
    const sigBytes = await hmacSha256(secret, sigPayload);
    const sig = toBase64Url(sigBytes);

    const token = `971mma:v2:supabase:${targetUserId}:${expEpoch}:${jti}:${sig}`;

    await svc
      .from('qr_tokens')
      .delete()
      .eq('user_id', targetUserId)
      .lt('expires_at', new Date().toISOString())
      .neq('jti', jti)
      .then(() => void 0);

    return jsonResponse({ token, expiresAt });
  } catch (error) {
    return toErrorResponse(error);
  }
});
