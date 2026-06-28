import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { signGateToken } from '../_shared/gateToken.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

type GateQrIssueRequest = {
  deviceLabel?: string;
};

const TOKEN_TTL_SECONDS = 90;
const REFRESH_INTERVAL_SECONDS = 20;

function requireLocationId(): string {
  const value = Deno.env.get('GATE_LOCATION_ID')?.trim();
  if (!value) throw new MbError('UPSTREAM_ERROR', 'Gate location not configured (GATE_LOCATION_ID).');
  return value;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const caller = await requireUser(req);
    requireRole(caller, ['gate', 'admin']);

    const body = (await req.json().catch(() => ({}))) as GateQrIssueRequest;
    const svc = serviceClient();
    const locationId = requireLocationId();

    const jti = crypto.randomUUID();
    const expEpoch = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const expiresAt = new Date(expEpoch * 1000).toISOString();
    const deviceLabel = body.deviceLabel?.trim() || null;

    const { error: insertError } = await svc.from('gate_tokens').insert({
      jti,
      location_id: locationId,
      expires_at: expiresAt,
      issued_by_user_id: caller.userId,
      device_label: deviceLabel,
    });
    if (insertError) throw new MbError('UPSTREAM_ERROR', 'Unable to persist gate token.');

    const token = await signGateToken(locationId, expEpoch, jti);

    const pruneBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await svc.from('gate_tokens').delete().lt('expires_at', pruneBefore).then(() => void 0);

    return jsonResponse({
      token,
      expiresAt,
      locationId,
      refreshInSeconds: REFRESH_INTERVAL_SECONDS,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
