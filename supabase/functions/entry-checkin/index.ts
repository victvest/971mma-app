import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { checkGeofence } from '../_shared/geofence.ts';
import { verifyGateToken } from '../_shared/gateToken.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { assertRateLimit } from '../_shared/rateLimit.ts';
import { serviceClient } from '../_shared/supabase.ts';

type EntryCheckinRequest = {
  gateToken?: string;
  latitude?: number;
  longitude?: number;
  targetUserId?: string;
  confirmMinorPresent?: boolean;
};

type ArrivalResponse = {
  Visit?: { Id?: unknown };
};

const GYM_TZ = 'Asia/Dubai';
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
/** 10 req/min per member — blocks brute-force token guessing without affecting normal retries. */

function shouldWriteArrivals(): boolean {
  return Deno.env.get('MB_WRITE_ARRIVALS') === 'true';
}

function gymTodayBounds(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TZ }).format(new Date());
  return {
    start: new Date(`${today}T00:00:00+04:00`).toISOString(),
    end: new Date(`${today}T23:59:59.999+04:00`).toISOString(),
  };
}

async function assertGateTokenRegistered(
  svc: SupabaseClient,
  jti: string,
  locationId: string,
): Promise<void> {
  const { data, error } = await svc
    .from('gate_tokens')
    .select('jti, location_id, expires_at')
    .eq('jti', jti)
    .maybeSingle<{ jti: string; location_id: string; expires_at: string }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read gate token.');
  if (!data) throw new MbError('TOKEN_INVALID', 'Entrance QR is not recognized.');
  if (data.location_id !== locationId) {
    throw new MbError('TOKEN_INVALID', 'Entrance QR location mismatch.');
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new MbError('TOKEN_EXPIRED', 'Entrance QR has expired. Scan the live code on the display.');
  }
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

function isGuardianProxyCheckIn(presentedBy: string | null, memberId: string): boolean {
  return Boolean(presentedBy && presentedBy !== memberId);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const caller = await requireUser(req);

    if (caller.role === 'gate') {
      throw new MbError(
        'FORBIDDEN',
        'Gate devices cannot check in members. Scan the entrance QR from the member app.',
      );
    }

    const body = (await req.json().catch(() => ({}))) as EntryCheckinRequest;
    const gateToken = body.gateToken?.trim();
    if (!gateToken) throw new MbError('BAD_REQUEST', 'gateToken is required.');

    assertRateLimit(`entry-checkin:${caller.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

    const svc = serviceClient();
    const { locationId, jti } = await verifyGateToken(gateToken);
    await assertGateTokenRegistered(svc, jti, locationId);

    const latitude = body.latitude;
    const longitude = body.longitude;
    if (latitude === undefined || longitude === undefined) {
      throw new MbError('BAD_REQUEST', 'latitude and longitude are required.');
    }

    const geofence = checkGeofence(latitude, longitude);
    if (!geofence.allowed) {
      return jsonResponse(
        {
          error: {
            code: 'OUTSIDE_GEOFENCE',
            message: 'You must be at the academy to check in.',
            distanceM: geofence.distanceM,
          },
        },
        { status: 403 },
      );
    }

    const targetUserId = await resolveTargetUserId(svc, caller.userId, body.targetUserId);
    let presentedBy: string | null = null;
    if (targetUserId !== caller.userId) {
      presentedBy = caller.userId;
      if (body.confirmMinorPresent !== true) {
        const memberName = await getMemberName(svc, targetUserId);
        return jsonResponse({
          needsConfirmation: true,
          memberId: targetUserId,
          memberName,
          message:
            'Confirm the trainee is physically present at the entrance before checking them in.',
        });
      }
    }

    if (await alreadyCheckedInToday(svc, targetUserId)) {
      throw new MbError(
        'ALREADY_CHECKED_IN',
        'Already checked in today. One visit per gym day.',
      );
    }

    const memberName = await getMemberName(svc, targetUserId);
    const checkedInAt = new Date().toISOString();

    let mindbodyVisitId: string | null = null;
    if (shouldWriteArrivals()) {
      try {
        const clientId = await resolveClientId(svc, targetUserId);
        const locationIdMb = parseInt(Deno.env.get('MINDBODY_LOCATION_ID') ?? '1', 10);
        const arrival = await mbFetch<ArrivalResponse>(svc, '/client/addarrival', {
          method: 'POST',
          body: JSON.stringify({ ClientId: clientId, LocationId: locationIdMb }),
        });
        const visitId = arrival.Visit?.Id;
        if (visitId !== undefined && visitId !== null) mindbodyVisitId = String(visitId);
      } catch (error) {
        console.warn('[entry-checkin] Mindbody AddArrival failed', {
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
        class_id: null,
        method: 'gate_scan',
        source: 'mindbody',
        mindbody_visit_id: mindbodyVisitId,
        gate_jti: jti,
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
