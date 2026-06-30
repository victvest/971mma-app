import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type ClientInfoRequest = {
  targetUserId?: string;
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

async function fetchMindbodyClient(
  linkedClientId: string,
): Promise<{ clientId: string | null; barcode: string | null }> {
  const query = new URLSearchParams({
    'request.clientIDs': linkedClientId,
    'request.includeInactive': 'true',
  });
  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${query.toString()}`,
  );
  const client = (response.Clients ?? []).find((row) => asString(row.Id) === linkedClientId);

  if (!client) {
    throw new MbError('NOT_LINKED', 'Mindbody client was not found.');
  }

  // Mindbody API: Id = scannable member barcode; UniqueId = internal system client ID.
  return {
    clientId: asString(client.UniqueId),
    barcode: asString(client.Id),
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const { userId: callerUserId } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as ClientInfoRequest;
    const svc = serviceClient();
    const userId = await resolveTargetUserId(svc, callerUserId, body.targetUserId);

    const { data: link, error: linkError } = await svc
      .from('mindbody_links')
      .select('mindbody_client_id')
      .eq('user_id', userId)
      .maybeSingle<{ mindbody_client_id: string }>();

    if (linkError || !link) {
      throw new MbError('NOT_LINKED', 'Mindbody account not linked.');
    }

    const info = await fetchMindbodyClient(link.mindbody_client_id);

    return jsonResponse({
      clientId: info.clientId,
      barcode: info.barcode,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
