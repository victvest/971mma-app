import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError } from '../_shared/errors.ts';
import { getToken, mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type HealthBody = {
  ok: boolean;
  siteId: string | null;
  tokenAcquired: boolean;
  site: { name: string } | null;
  sandboxKeyOnly?: boolean;
  error?: string;
};

type SitesResponse = {
  Sites?: Array<{ Name?: unknown }>;
};

function healthResponse(body: HealthBody, init?: ResponseInit): Response {
  return jsonResponse(body, init);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return healthResponse(
      {
        ok: false,
        siteId: Deno.env.get('MINDBODY_SITE_ID') ?? null,
        tokenAcquired: false,
        site: null,
      },
      { status: 405 },
    );
  }

  const siteId = Deno.env.get('MINDBODY_SITE_ID') ?? null;

  try {
    const svc = serviceClient();
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const forceRefresh =
      body === true ||
      (typeof body === 'object' &&
        body !== null &&
        (body.force === true || body.forceTokenRefresh === true));

    let tokenAcquired = false;
    try {
      await getToken(svc, forceRefresh);
      tokenAcquired = true;
    } catch (tokenError) {
      if (siteId !== '-99') throw tokenError;
    }

    const siteBody = await mbFetch<SitesResponse>(svc, '/site/sites');
    const sites = Array.isArray(siteBody.Sites) ? siteBody.Sites : [];
    const firstSite = sites[0] as { Name?: unknown } | undefined;
    const name = typeof firstSite?.Name === 'string' ? firstSite.Name : null;
    const sandboxKeyOnly = siteId === '-99' && !tokenAcquired;

    return healthResponse({
      ok: Boolean(name),
      siteId,
      tokenAcquired,
      site: name ? { name } : null,
      ...(sandboxKeyOnly ? { sandboxKeyOnly: true } : {}),
    });
  } catch (error) {
    const message =
      error instanceof MbError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Mindbody health check failed.';
    return healthResponse(
      { ok: false, siteId, tokenAcquired: false, site: null, error: message },
      { status: 200 },
    );
  }
});
