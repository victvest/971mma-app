import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveGateMemberProfile } from '../_shared/accessControl.ts';
import { requireSaltoBearerToken } from '../_shared/saltoAuth.ts';
import { serviceClient } from '../_shared/supabase.ts';

type SaltoProfileRequest = Record<string, unknown>;

function readString(payload: SaltoProfileRequest, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
      req,
    );
  }

  try {
    requireSaltoBearerToken(req);
  } catch (error) {
    return toErrorResponse(error, req);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SaltoProfileRequest;
    const memberId = readString(body, ['MemberId', 'memberId']) ?? '';
    if (!memberId) {
      throw new MbError('BAD_REQUEST', 'MemberId is required.');
    }

    const profile = await resolveGateMemberProfile(serviceClient(), memberId);
    if (!profile) {
      throw new MbError('BAD_REQUEST', 'Member not found.');
    }

    return jsonResponse(
      {
        FirstName: profile.firstName,
        LastName: profile.lastName,
        FullName: profile.fullName,
        DisplayName: profile.displayName,
        ImageBase64: profile.imageBase64,
      },
      {},
      req,
    );
  } catch (error) {
    return toErrorResponse(error, req);
  }
});
