import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { signMemberQrToken } from '../_shared/memberQrToken.ts';
import { serviceClient } from '../_shared/supabase.ts';

type QrIssueRequest = {
  targetUserId?: string;
};

const TOKEN_TTL_SECONDS = 5 * 60;

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

    const token = await signMemberQrToken('supabase', targetUserId, expEpoch, jti);

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
