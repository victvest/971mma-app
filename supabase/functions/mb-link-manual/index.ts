import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { writeAdminAudit } from '../_shared/adminAudit.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type ManualLinkRequest = {
  userId?: string;
  mindbodyClientId?: string;
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

function cleanId(value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new MbError('BAD_REQUEST', 'userId and mindbodyClientId are required.');
  return cleaned;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

async function fetchMindbodyClient(clientId: string): Promise<{ clientId: string; uniqueId: string | null }> {
  const query = new URLSearchParams({
    'request.clientIDs': clientId,
    'request.includeInactive': 'true',
  });
  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${query.toString()}`,
  );
  const client = (response.Clients ?? []).find((row) => asString(row.Id) === clientId);

  if (!client) {
    throw new MbError('NOT_LINKED', 'Mindbody client was not found.');
  }

  return {
    clientId,
    uniqueId: asString(client.UniqueId),
  };
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
    const admin = await requireUser(req);
    requireRole(admin, ['admin']);

    const body = (await req.json().catch(() => ({}))) as ManualLinkRequest;
    const userId = cleanId(body.userId);
    const mindbodyClientId = cleanId(body.mindbodyClientId);
    const mbClient = await fetchMindbodyClient(mindbodyClientId);
    const svc = serviceClient();

    const { data: profile, error: profileError } = await svc
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle<{ id: string }>();

    if (profileError || !profile) {
      throw new MbError('BAD_REQUEST', 'Supabase profile was not found.');
    }

    const { error: upsertError } = await svc.from('mindbody_links').upsert({
      user_id: userId,
      mindbody_client_id: mbClient.clientId,
      mindbody_unique_id: mbClient.uniqueId,
      link_method: 'manual',
    });

    if (upsertError) {
      const conflict = upsertError.code === '23505';
      throw new MbError(
        conflict ? 'AMBIGUOUS_MATCH' : 'UPSTREAM_ERROR',
        conflict
          ? 'This Mindbody client is already linked to another account.'
          : 'Unable to store manual Mindbody link.',
      );
    }

    await svc
      .from('profiles')
      .update({
        mindbody_synced_at: new Date().toISOString(),
        account_status: 'active',
      })
      .eq('id', userId);

    // Get email and phone from auth.users
    const { data: authData } = await svc.auth.admin.getUserById(userId);
    const email = authData?.user?.email ?? null;
    const phone = authData?.user?.phone ?? null;

    // Log the successful manual link attempt
    await svc.from('mindbody_link_attempts').insert({
      user_id: userId,
      verified_email: email,
      verified_phone: phone,
      match_basis: 'manual_fallback',
      match_count: 1,
      status: 'linked',
      matched_mindbody_client_id: mbClient.clientId,
      raw_matches: [{ Id: mbClient.clientId, UniqueId: mbClient.uniqueId }],
    });

    await writeAdminAudit(svc, admin.userId, 'manual_mindbody_link', 'mindbody_links', userId, {
      mindbodyClientId: mbClient.clientId,
      linkMethod: 'manual',
    });

    return jsonResponse({
      userId,
      clientId: mbClient.clientId,
      uniqueId: mbClient.uniqueId,
      linkMethod: 'manual',
      linkedBy: admin.userId,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
