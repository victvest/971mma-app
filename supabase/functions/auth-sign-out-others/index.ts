import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

function bearerToken(req: Request): string {
  const header = req.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    throw new MbError('UNAUTHORIZED', 'Sign in is required.');
  }
  return token;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
    );
  }

  try {
    // Validate the caller, then revoke every other session for this JWT.
    await requireUser(req);
    const jwt = bearerToken(req);
    const svc = serviceClient();

    const { error } = await svc.auth.admin.signOut(jwt, 'others');
    if (error) {
      throw new MbError(
        'UPSTREAM_ERROR',
        error.message || 'Unable to sign out other devices.',
      );
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
});
