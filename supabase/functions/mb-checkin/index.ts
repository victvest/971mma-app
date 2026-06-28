import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { serviceClient } from '../_shared/supabase.ts';

type CheckInRequest = {
  token?: string;
  classId?: string;
  userId?: string;
  targetUserId?: string;
  confirmMinorPresent?: boolean;
};

type ArrivalResponse = {
  Visit?: { Id?: unknown };
};

function allowSelfCheckIn(): boolean {
  return Deno.env.get('MB_ALLOW_SELF_CHECKIN')?.toLowerCase() !== 'false';
}

function shouldWriteArrivals(): boolean {
  return Deno.env.get('MB_WRITE_ARRIVALS') === 'true';
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

async function verifyToken(
  token: string,
  secret: string,
): Promise<{ memberId: string; jti: string }> {
  const parts = token.split(':');

  if (parts.length !== 7 || parts[0] !== '971mma' || parts[1] !== 'v2') {
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

  const sigPayload = `${source}:${memberId}:${expEpoch}:${jti}`;
  const expectedBytes = await hmacSha256(secret, sigPayload);
  const expected = toBase64Url(expectedBytes);

  if (!timingSafeEqual(expected, sig)) {
    throw new MbError('TOKEN_INVALID', 'Invalid token signature.');
  }

  return { memberId, jti };
}

async function consumeToken(svc: SupabaseClient, jti: string, memberId: string): Promise<void> {
  const { data, error } = await svc
    .from('qr_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('jti', jti)
    .eq('user_id', memberId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to consume QR token.');
  if (!data) throw new MbError('TOKEN_REPLAYED', 'QR code has already been used.');
}

async function isTokenConsumed(svc: SupabaseClient, jti: string): Promise<boolean> {
  const { data, error } = await svc
    .from('qr_tokens')
    .select('consumed_at')
    .eq('jti', jti)
    .maybeSingle<{ consumed_at: string | null }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read QR token.');
  return Boolean(data?.consumed_at);
}

async function resolveClientId(svc: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await svc
    .from('mindbody_links')
    .select('mindbody_client_id')
    .eq('user_id', userId)
    .maybeSingle<{ mindbody_client_id: string }>();

  if (error || !data) throw new MbError('NOT_LINKED', 'Mindbody account not linked.');
  return data.mindbody_client_id;
}

async function getMemberName(svc: SupabaseClient, userId: string): Promise<string> {
  const { data } = await svc
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle<{ full_name: string | null }>();
  return data?.full_name ?? 'Member';
}

const GYM_TZ = 'Asia/Dubai';

function gymTodayBounds(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TZ }).format(new Date());
  return {
    start: new Date(`${today}T00:00:00+04:00`).toISOString(),
    end: new Date(`${today}T23:59:59.999+04:00`).toISOString(),
  };
}

async function getTokenPresenter(
  svc: SupabaseClient,
  jti: string,
): Promise<{ presentedBy: string | null; memberId: string } | null> {
  const { data, error } = await svc
    .from('qr_tokens')
    .select('user_id, issued_by_user_id')
    .eq('jti', jti)
    .maybeSingle<{ user_id: string; issued_by_user_id: string | null }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read QR token.');
  if (!data) return null;

  return {
    memberId: data.user_id,
    presentedBy: data.issued_by_user_id,
  };
}

function isGuardianProxyCheckIn(presentedBy: string | null, memberId: string): boolean {
  return Boolean(presentedBy && presentedBy !== memberId);
}

async function alreadyCheckedInToday(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { start, end } = gymTodayBounds();
  const { data, error } = await svc
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)
    .limit(1)
    .maybeSingle();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read check-in history.');
  return Boolean(data);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const caller = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as CheckInRequest;
    const svc = serviceClient();

    let targetUserId: string;
    let pendingJti: string | null = null;
    let presentedBy: string | null = null;

    let checkInMethod: 'qr_scan' | 'qr_self' | 'coach_roster';

    if (body.token) {
      requireRole(caller, ['coach', 'admin']);
      const secret = Deno.env.get('QR_SIGNING_SECRET');
      if (!secret) throw new MbError('UPSTREAM_ERROR', 'QR signing not configured.');

      const { memberId, jti } = await verifyToken(body.token, secret);
      targetUserId = memberId;
      pendingJti = jti;
      checkInMethod = 'qr_scan';

      if (await isTokenConsumed(svc, jti)) {
        throw new MbError('TOKEN_REPLAYED', 'QR code has already been used.');
      }

      const tokenMeta = await getTokenPresenter(svc, jti);
      presentedBy = tokenMeta?.presentedBy ?? null;

      if (isGuardianProxyCheckIn(presentedBy, targetUserId) && body.confirmMinorPresent !== true) {
        const memberName = await getMemberName(svc, targetUserId);
        return jsonResponse({
          needsConfirmation: true,
          memberId: targetUserId,
          memberName,
          message:
            'This QR was shown by a parent/guardian. Confirm the trainee is physically present before checking them in.',
        });
      }
    } else if (body.userId) {
      requireRole(caller, ['coach', 'admin']);
      targetUserId = body.userId.trim();
      if (!targetUserId) throw new MbError('BAD_REQUEST', 'userId is required.');
      checkInMethod = 'coach_roster';
    } else {
      if (!allowSelfCheckIn()) {
        throw new MbError(
          'FORBIDDEN',
          'Self check-in is disabled. Please show your QR code to a coach or front desk.',
        );
      }
      targetUserId = await resolveTargetUserId(svc, caller.userId, body.targetUserId);
      checkInMethod = 'qr_self';
      if (targetUserId !== caller.userId) {
        presentedBy = caller.userId;
      }
    }

    if (await alreadyCheckedInToday(svc, targetUserId)) {
      throw new MbError(
        'ALREADY_CHECKED_IN',
        'Already checked in today. One visit per gym day.',
      );
    }

    if (pendingJti) {
      await consumeToken(svc, pendingJti, targetUserId);
    }

    const memberName = await getMemberName(svc, targetUserId);
    const checkedInAt = new Date().toISOString();

    let mindbodyVisitId: string | null = null;
    if (shouldWriteArrivals()) {
      try {
        const clientId = await resolveClientId(svc, targetUserId);
        const locationId = parseInt(Deno.env.get('MINDBODY_LOCATION_ID') ?? '1', 10);
        const arrival = await mbFetch<ArrivalResponse>(svc, '/client/addarrival', {
          method: 'POST',
          body: JSON.stringify({ ClientId: clientId, LocationId: locationId }),
        });
        const visitId = arrival.Visit?.Id;
        if (visitId !== undefined && visitId !== null) mindbodyVisitId = String(visitId);
      } catch (error) {
        console.warn('[mb-checkin] Mindbody AddArrival failed', {
          hasClassId: Boolean(body.classId),
          reason: error instanceof Error ? error.name : 'unknown',
        });
        throw new MbError(
          'UPSTREAM_ERROR',
          'Mindbody arrival write-back failed. Attendance was not recorded.',
        );
      }
    }

    const { data: inserted, error: insertError } = await svc
      .from('check_ins')
      .insert({
        user_id: targetUserId,
        class_id: body.classId ?? null,
        method: checkInMethod,
        source: 'mindbody',
        mindbody_visit_id: mindbodyVisitId,
        presented_by: isGuardianProxyCheckIn(presentedBy, targetUserId) ? presentedBy : null,
      })
      .select('id')
      .single<{ id: string }>();

    if (insertError) throw new MbError('UPSTREAM_ERROR', 'Unable to record check-in.');

    return jsonResponse({
      success: true,
      memberName,
      checkedInAt,
      checkInId: inserted.id,
      guardianProxy: isGuardianProxyCheckIn(presentedBy, targetUserId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
