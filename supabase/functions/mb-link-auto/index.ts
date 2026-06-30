import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { writeAdminAudit } from '../_shared/adminAudit.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type AutoLinkRequest = {
  userId?: string;
};

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
  Email?: unknown;
  MobilePhone?: unknown;
  HomePhone?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

type AddClientResponse = {
  Client?: MbClient;
};

function cleanUserId(value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new MbError('BAD_REQUEST', 'userId is required.');
  return cleaned;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function clientId(client: MbClient): string | null {
  return asString(client.Id);
}

function uniqueId(client: MbClient): string | null {
  return asString(client.UniqueId);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function clientEmail(client: MbClient): string | null {
  return typeof client.Email === 'string' ? normalizeEmail(client.Email) : null;
}

function clientPhone(client: MbClient): string | null {
  const phone =
    typeof client.MobilePhone === 'string'
      ? client.MobilePhone
      : typeof client.HomePhone === 'string'
        ? client.HomePhone
        : null;
  return phone?.trim() ? normalizePhone(phone) : null;
}

function phonesMatch(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length >= 7 && right.length >= 7) {
    return left.endsWith(right) || right.endsWith(left);
  }
  return false;
}

function defaultBirthDate(): string {
  const configured = Deno.env.get('MB_DEFAULT_BIRTH_DATE')?.trim();
  if (configured) return configured;
  return '1990-01-01T00:00:00';
}

function splitName(
  fullName: string | null,
  email: string,
): { firstName: string; lastName: string } {
  const cleaned = fullName?.trim();
  if (!cleaned) {
    const fallback = email.split('@')[0] || '971';
    return { firstName: fallback, lastName: 'Member' };
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Member' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function isDuplicateClientError(error: unknown): boolean {
  return error instanceof MbError && error.message.includes('InvalidClientCreation');
}

async function searchClients(searchText: string): Promise<MbClient[]> {
  const query = new URLSearchParams({
    'request.searchText': searchText,
    'request.includeInactive': 'true',
  });
  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${query.toString()}`,
  );
  return (response.Clients ?? []).filter((client) => Boolean(clientId(client)));
}

async function getMindbodyLinkOwner(
  svc: ReturnType<typeof serviceClient>,
  mindbodyClientId: string,
): Promise<string | null> {
  const { data, error } = await svc
    .from('mindbody_links')
    .select('user_id')
    .eq('mindbody_client_id', mindbodyClientId)
    .maybeSingle<{ user_id: string }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to verify Mindbody link.');
  return data?.user_id ?? null;
}

async function ensureClientLinkable(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  client: MbClient,
): Promise<string> {
  const mbClientId = clientId(client);
  if (!mbClientId) {
    throw new MbError('UPSTREAM_ERROR', 'Mindbody client is missing an Id.');
  }

  const owner = await getMindbodyLinkOwner(svc, mbClientId);
  if (owner && owner !== userId) {
    throw new MbError(
      'AMBIGUOUS_MATCH',
      'This Mindbody client is already linked to another app account.',
    );
  }

  return mbClientId;
}

async function findLinkableEmailMatch(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  email: string,
): Promise<MbClient | null> {
  const target = normalizeEmail(email);
  const matches = (await searchClients(email)).filter(
    (client) => clientEmail(client) === target,
  );

  const available: MbClient[] = [];
  for (const client of matches) {
    const id = clientId(client);
    if (!id) continue;
    const owner = await getMindbodyLinkOwner(svc, id);
    if (!owner || owner === userId) available.push(client);
  }

  return available.length === 1 ? available[0] : null;
}

async function createMindbodyClient(
  email: string,
  profile: ProfileRow,
): Promise<MbClient> {
  const { firstName, lastName } = splitName(profile.full_name, email);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await mbFetch<AddClientResponse>(serviceClient(), '/client/addclient', {
        method: 'POST',
        body: JSON.stringify({
          FirstName: firstName,
          LastName: lastName,
          Email: email,
          BirthDate: defaultBirthDate(),
          MobilePhone: profile.phone ?? undefined,
          ReactivateInactiveClient: true,
        }),
      });

      if (!response.Client || !clientId(response.Client)) {
        throw new MbError('UPSTREAM_ERROR', 'Mindbody did not return a created client.');
      }

      return response.Client;
    } catch (error) {
      if (!isDuplicateClientError(error)) throw error;
      if (attempt === 1) break;
    }
  }

  throw new MbError(
    'AMBIGUOUS_MATCH',
    'A Mindbody profile with this email already exists. Use manual link with the existing client ID.',
  );
}

async function storeLink(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  client: MbClient,
  linkMethod: 'created' | 'matched_email',
  email: string,
  phone: string | null,
  rawMatches: MbClient[],
) {
  const mbClientId = await ensureClientLinkable(svc, userId, client);

  const { error: upsertError } = await svc.from('mindbody_links').upsert({
    user_id: userId,
    mindbody_client_id: mbClientId,
    mindbody_unique_id: uniqueId(client),
    link_method: linkMethod,
  });

  if (upsertError) {
    const conflict = upsertError.code === '23505';
    throw new MbError(
      conflict ? 'AMBIGUOUS_MATCH' : 'UPSTREAM_ERROR',
      conflict
        ? 'This Mindbody client is already linked to another account.'
        : 'Unable to store Mindbody link.',
    );
  }

  await svc
    .from('profiles')
    .update({
      mindbody_synced_at: new Date().toISOString(),
      account_status: 'active',
    })
    .eq('id', userId);

  await svc.from('mindbody_link_attempts').insert({
    user_id: userId,
    verified_email: email,
    verified_phone: phone,
    match_basis: linkMethod === 'created' ? 'email' : 'email',
    match_count: 1,
    status: 'linked',
    matched_mindbody_client_id: mbClientId,
    raw_matches: rawMatches,
  });

  return {
    clientId: mbClientId,
    uniqueId: uniqueId(client),
    linkMethod,
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
    const caller = await requireUser(req);
    requireRole(caller, ['admin', 'coach']);

    const body = (await req.json().catch(() => ({}))) as AutoLinkRequest;
    const userId = cleanUserId(body.userId);
    const svc = serviceClient();

    const { data: profile, error: profileError } = await svc
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (profileError || !profile) {
      throw new MbError('BAD_REQUEST', 'Supabase profile was not found.');
    }

    const { data: authData, error: authError } = await svc.auth.admin.getUserById(userId);
    if (authError || !authData.user?.email) {
      throw new MbError('BAD_REQUEST', 'Member email is required before auto-linking.');
    }

    const email = normalizeEmail(authData.user.email);
    const phone = profile.phone ?? authData.user.phone ?? null;

    const { data: existingLink } = await svc
      .from('mindbody_links')
      .select('mindbody_client_id, mindbody_unique_id, link_method')
      .eq('user_id', userId)
      .maybeSingle<{ mindbody_client_id: string; mindbody_unique_id: string | null; link_method: string }>();

    if (existingLink) {
      await svc
        .from('profiles')
        .update({ account_status: 'active', mindbody_synced_at: new Date().toISOString() })
        .eq('id', userId);

      return jsonResponse({
        userId,
        clientId: existingLink.mindbody_client_id,
        uniqueId: existingLink.mindbody_unique_id,
        linkMethod: existingLink.link_method,
        linkedBy: caller.userId,
        alreadyLinked: true,
      });
    }

    const emailMatch = await findLinkableEmailMatch(svc, userId, email);
    let result: { clientId: string; uniqueId: string | null; linkMethod: string };

    if (emailMatch) {
      const stored = await storeLink(
        svc,
        userId,
        emailMatch,
        'matched_email',
        email,
        phone,
        [emailMatch],
      );
      result = stored;
    } else if (caller.role === 'coach') {
      throw new MbError(
        'NOT_LINKED',
        'No exact Mindbody email match found. Enter the member Mindbody client ID manually.',
      );
    } else {
      const created = await createMindbodyClient(email, profile);
      const stored = await storeLink(
        svc,
        userId,
        created,
        'created',
        email,
        phone,
        [created],
      );
      result = stored;
    }

    await writeAdminAudit(svc, caller.userId, 'auto_mindbody_link', 'mindbody_links', userId, {
      mindbodyClientId: result.clientId,
      linkMethod: result.linkMethod,
    });

    return jsonResponse({
      userId,
      clientId: result.clientId,
      uniqueId: result.uniqueId,
      linkMethod: result.linkMethod,
      linkedBy: caller.userId,
      alreadyLinked: false,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
