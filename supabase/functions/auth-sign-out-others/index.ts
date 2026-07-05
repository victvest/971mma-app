import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

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
    const user = await requireUser(req);
    const svc = serviceClient();

    const { error } = await svc.auth.admin.signOut(user.userId, 'others');
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
