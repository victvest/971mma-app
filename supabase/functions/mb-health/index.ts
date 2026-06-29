import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError } from '../_shared/errors.ts';
import { getToken, mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type HealthBody = {
  ok: boolean;
  siteId: string | null;
  tokenAcquired: boolean;
  autoLinkReady: boolean;
  site: { name: string } | null;
  sandboxKeyOnly?: boolean;
  error?: string;
};

type SitesResponse = {
  Sites?: Array<{ Id?: unknown; Name?: unknown }>;
};

function siteNameForConfiguredId(
  sites: SitesResponse['Sites'],
  configuredSiteId: string | null,
): string | null {
  if (!Array.isArray(sites) || !configuredSiteId) return null;

  const match = sites.find((site) => String(site.Id) === configuredSiteId);
  return typeof match?.Name === 'string' ? match.Name : null;
}

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
        autoLinkReady: false,
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
    } catch {
      // Reads may still work with API-key-only when token issue fails.
    }

    const siteBody = await mbFetch<SitesResponse>(svc, '/site/sites');
    const sites = Array.isArray(siteBody.Sites) ? siteBody.Sites : [];
    const name = siteNameForConfiguredId(sites, siteId);
    const sandboxKeyOnly = !tokenAcquired;

    return healthResponse({
      ok: Boolean(name),
      siteId,
      tokenAcquired,
      autoLinkReady: tokenAcquired,
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
      { ok: false, siteId, tokenAcquired: false, autoLinkReady: false, site: null, error: message },
      { status: 200 },
    );
  }
});
