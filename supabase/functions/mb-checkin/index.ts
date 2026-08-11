import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { verifyMemberQrToken } from '../_shared/memberQrToken.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type CheckInRequest = {
  token?: string;
  classId?: string;
  userId?: string;
  confirmMinorPresent?: boolean;
};

type ArrivalResponse = {
  Visit?: { Id?: unknown };
};

function shouldWriteArrivals(): boolean {
  return Deno.env.get('MB_WRITE_ARRIVALS') === 'true';
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
    let presentedBy: string | null = null;

    let checkInMethod: 'coach_roster';

    if (body.token) {
      requireRole(caller, ['coach', 'admin']);

      // Facility entry is SALTO-only (member shows QR to Gantner). The legacy path
      // where a coach scanned a member QR *without* a class created method=qr_scan
      // facility rows and consumed the same jti SALTO needs — that raced the gate.
      // Class attendance must go through Run Class / roll-call (record_roll_call_mark).
      if (!body.classId?.trim()) {
        throw new MbError(
          'BAD_REQUEST',
          'Facility check-in is handled by the academy gate scanner. For class attendance, open Run Class and scan from roll call.',
        );
      }

      const { memberId, jti } = await verifyMemberQrToken(body.token);
      targetUserId = memberId;
      // Class-linked coach scan — never occupy the facility unique index (gate_scan/qr_scan)
      // and never consume the member QR (SALTO owns one-shot at the academy gate).
      checkInMethod = 'coach_roster';

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
      // Check-in is coach/front-desk mediated: either scan the member's QR (token)
      // or mark them from the class roster (userId). Members cannot check themselves in.
      throw new MbError(
        'BAD_REQUEST',
        'A QR token or member id is required. Show your QR code to a coach or front desk.',
      );
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
