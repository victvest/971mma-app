import {
  buildFailureResponse,
  enqueueMembershipRefreshJob,
  evaluateGateAccessByMemberId,
  gateResponseForDecision,
  normalizeGateAttemptType,
  recordGateAccessAttempt,
} from '../_shared/accessControl.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError } from '../_shared/errors.ts';
import { requireSaltoBearerToken } from '../_shared/saltoAuth.ts';
import { serviceClient } from '../_shared/supabase.ts';

type SaltoMemberAccessRequest = Record<string, unknown>;

function readString(payload: SaltoMemberAccessRequest, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function mapAccessErrorMessage(error: MbError): string {
  switch (error.code) {
    case 'BAD_REQUEST':
      return 'Invalid request payload.';
    default:
      return 'Access unavailable. Please contact front desk.';
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  // SALTO's reader expects every access response to be a { Granted, Message } JSON
  // decision it can display. Return that shape (HTTP 200) even for method/auth
  // failures rather than a { error } envelope, so the middleware always parses a
  // decision. Messages stay distinct so operators can tell these apart in logs.
  if (req.method !== 'POST') {
    return jsonResponse(buildFailureResponse('Access unavailable. Please contact front desk.'), {}, req);
  }

  try {
    requireSaltoBearerToken(req);
  } catch {
    return jsonResponse(buildFailureResponse('Access unavailable. Please contact front desk.'), {}, req);
  }

  const svc = serviceClient();
  const requestedAt = new Date().toISOString();
  let body: SaltoMemberAccessRequest = {};

  try {
    body = (await req.json().catch(() => ({}))) as SaltoMemberAccessRequest;
    const memberId = readString(body, ['MemberId', 'memberId']) ?? '';
    const rawDeviceId = readString(body, ['DeviceId', 'deviceId']);
    const deviceId = rawDeviceId ?? 'unknown';

    if (!memberId || !rawDeviceId) {
      const response = buildFailureResponse('Invalid request payload.');
      await recordGateAccessAttempt(svc, {
        deviceId,
        type: normalizeGateAttemptType('MemberId'),
        requestType: 'MemberId',
        granted: false,
        message: response.Message,
        reasonCode: 'bad_request',
        rawRequest: body,
        rawResponse: response,
        requestedAt,
        respondedAt: new Date().toISOString(),
      }).catch((attemptError) => {
        console.warn('[salto-access-by-member-id] failed to log bad request', attemptError);
      });
      return jsonResponse(response, {}, req);
    }

    const decision = await evaluateGateAccessByMemberId({
      svc,
      deviceId,
      memberId,
    });

    if (decision.shouldEnqueueMembershipRefresh && decision.memberUserId) {
      await enqueueMembershipRefreshJob(
        svc,
        decision.memberUserId,
        'salto_live_member_id_access_refresh',
      ).catch((jobError) => {
        console.warn('[salto-access-by-member-id] failed to enqueue membership refresh', jobError);
      });
    }

    const response = gateResponseForDecision(decision);
    await recordGateAccessAttempt(svc, {
      memberUserId: decision.memberUserId,
      mindbodyClientId: decision.mindbodyClientId,
      deviceId,
      type: decision.type,
      requestType: decision.requestType,
      granted: decision.granted,
      message: decision.message,
      reasonCode: decision.reasonCode,
      membershipStatus: decision.membershipStatus,
      membershipLastSyncedAt: decision.membershipLastSyncedAt,
      tokenJti: decision.tokenJti,
      tokenExpiresAt: decision.tokenExpiresAt,
      checkInId: decision.checkInId,
      arrivalJobId: decision.arrivalJobId,
      rawRequest: body,
      rawResponse: response,
      requestedAt,
      respondedAt: new Date().toISOString(),
    }).catch((attemptError) => {
      console.warn('[salto-access-by-member-id] failed to log access attempt', attemptError);
    });

    return jsonResponse(response, {}, req);
  } catch (error) {
    const deviceId = readString(body, ['DeviceId', 'deviceId']) ?? 'unknown';
    const response = buildFailureResponse(
      error instanceof MbError
        ? mapAccessErrorMessage(error)
        : 'Access unavailable. Please contact front desk.',
    );

    await recordGateAccessAttempt(svc, {
      deviceId,
      type: normalizeGateAttemptType('MemberId'),
      requestType: 'MemberId',
      granted: false,
      message: response.Message,
      reasonCode: error instanceof MbError ? error.code.toLowerCase() : 'unexpected_error',
      rawRequest: body,
      rawResponse: response,
      requestedAt,
      respondedAt: new Date().toISOString(),
    }).catch((attemptError) => {
      console.warn('[salto-access-by-member-id] failed to log exception', attemptError);
    });

    return jsonResponse(response, {}, req);
  }
});
