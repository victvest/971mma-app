import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

type StaffRequest = {
  force?: boolean;
};

/**
 * Coach directory is academy-curated (seeded from 971mma.com), not Mindbody staff.
 * This endpoint is kept for backward compatibility with existing clients/scripts.
 */
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
    await requireUser(req);
    await req.json().catch(() => ({})) as StaffRequest;
    const svc = serviceClient();

    const { count, error } = await svc
      .from('coaches')
      .select('id', { count: 'exact', head: true })
      .not('slug', 'is', null);

    if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read academy coach directory.');

    return jsonResponse({
      refreshed: false,
      skipped: true,
      reason: 'academy_curated',
      count: count ?? 0,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
