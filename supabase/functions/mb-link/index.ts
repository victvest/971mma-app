import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { mbFetch, getToken } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type LinkMethod = 'matched_email' | 'matched_phone' | 'created' | 'manual';

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
};

type ExistingClientLinkRow = {
  user_id: string;
};

async function ensureMemberProfile(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<ProfileRow> {
  const { data: profile, error } = await svc
    .from('profiles')
    .select('full_name, phone')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read profile.');
  if (profile) return profile;

  const { data: authData, error: authError } = await svc.auth.admin.getUserById(userId);
  if (authError || !authData.user) {
    throw new MbError('BAD_REQUEST', 'Profile is required before linking Mindbody.');
  }

  const metadata = authData.user.user_metadata ?? {};
  const fullName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    null;

  const { error: insertError } = await svc.from('profiles').insert({
    id: userId,
    full_name: fullName,
    role: 'member',
    account_status: 'registered',
  });

  if (insertError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to create profile before linking Mindbody.');
  }

  return { full_name: fullName, phone: null };
}

async function getMindbodyLinkOwner(
  svc: ReturnType<typeof serviceClient>,
  mindbodyClientId: string,
): Promise<string | null> {
  const { data, error } = await svc
    .from('mindbody_links')
    .select('user_id')
    .eq('mindbody_client_id', mindbodyClientId)
    .maybeSingle<ExistingClientLinkRow>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to verify Mindbody link.');
  return data?.user_id ?? null;
}

async function authUserExists(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await svc.auth.admin.getUserById(userId);
  return !error && Boolean(data.user);
}

async function getAuthEmail(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return normalizeEmail(data.user.email);
}

function isSandboxSite(): boolean {
  return Deno.env.get('MINDBODY_SITE_ID') === '-99';
}

function isDuplicateClientError(error: unknown): boolean {
  return error instanceof MbError && error.message.includes('InvalidClientCreation');
}

async function repairMisassignedMindbodyEmail(
  svc: ReturnType<typeof serviceClient>,
  ownerUserId: string,
  client: MbClient,
  currentEmail: string,
): Promise<boolean> {
  if (!isSandboxSite()) return false;

  const mbClientId = clientId(client);
  const mindbodyEmail = clientEmail(client);
  if (!mbClientId || !mindbodyEmail || mindbodyEmail !== normalizeEmail(currentEmail)) {
    return false;
  }

  const ownerEmail = await getAuthEmail(svc, ownerUserId);
  if (!ownerEmail || ownerEmail === normalizeEmail(currentEmail)) return false;

  await mbFetch(serviceClient(), '/client/updateclient', {
    method: 'POST',
    body: JSON.stringify({
      CrossRegionalUpdate: false,
      Client: {
        Id: mbClientId,
        Email: ownerEmail,
      },
    }),
  });
  return true;
}

async function releaseStaleMindbodyLink(
  svc: ReturnType<typeof serviceClient>,
  currentUserId: string,
  currentEmail: string,
  ownerUserId: string,
  client: MbClient,
): Promise<boolean> {
  if (ownerUserId === currentUserId) return true;

  // Only reclaim links left behind when the previous Supabase account no longer exists.
  if (await authUserExists(svc, ownerUserId)) return false;

  const mindbodyEmail = clientEmail(client);
  if (!mindbodyEmail || mindbodyEmail !== normalizeEmail(currentEmail)) return false;

  const { error } = await svc.from('mindbody_links').delete().eq('user_id', ownerUserId);
  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to clear stale Mindbody link.');
  return true;
}

async function getAvailableClients(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  currentEmail: string,
  clients: MbClient[],
): Promise<MbClient[]> {
  const available: MbClient[] = [];
  for (const candidate of clients) {
    const id = clientId(candidate);
    if (!id) continue;

    const owner = await getMindbodyLinkOwner(svc, id);
    if (!owner || owner === userId) {
      available.push(candidate);
      continue;
    }

    const released = await releaseStaleMindbodyLink(svc, userId, currentEmail, owner, candidate);
    if (released) available.push(candidate);
  }
  return available;
}

async function ensureClientLinkable(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  email: string,
  client: MbClient,
): Promise<void> {
  const mbClientId = clientId(client);
  if (!mbClientId) {
    throw new MbError('UPSTREAM_ERROR', 'Mindbody client is missing an Id.');
  }

  const owner = await getMindbodyLinkOwner(svc, mbClientId);
  if (!owner || owner === userId) return;

  const released = await releaseStaleMindbodyLink(svc, userId, email, owner, client);
  if (released) return;

  throw new MbError('CLIENT_OWNED', 'Mindbody client is linked to another active app account.');
}

function upsertLinkErrorMessage(upsertError: { code?: string }): MbError {
  if (upsertError.code === '23505') {
    return new MbError(
      'AMBIGUOUS_MATCH',
      'This Mindbody profile is already linked to another app account. Sign in with your original email or ask the front desk to relink.',
    );
  }

  return new MbError('UPSTREAM_ERROR', 'Unable to store Mindbody link.');
}

type MindbodyLinkRow = {
  user_id: string;
  mindbody_client_id: string;
  mindbody_unique_id: string | null;
  linked_at: string;
  link_method: LinkMethod;
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Email?: unknown;
  MobilePhone?: unknown;
  HomePhone?: unknown;
  Active?: unknown;
  Status?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

type AddClientResponse = {
  Client?: MbClient;
};

function allowClientCreate(): boolean {
  return Deno.env.get('MB_ALLOW_CLIENT_CREATE')?.toLowerCase() !== 'false';
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

function clientId(client: MbClient): string | null {
  const id = client.Id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

function uniqueId(client: MbClient): string | null {
  const id = client.UniqueId;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
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

function filterByExactEmail(clients: MbClient[], email: string): MbClient[] {
  const target = normalizeEmail(email);
  if (!target) return [];
  return clients.filter((client) => clientEmail(client) === target);
}

function filterByExactPhone(clients: MbClient[], phone: string): MbClient[] {
  const target = normalizePhone(phone);
  if (!target || target.length < 7) return [];
  return clients.filter((client) => {
    const candidate = clientPhone(client);
    return candidate ? phonesMatch(candidate, target) : false;
  });
}

async function mindbodyAutoLinkReady(svc: ReturnType<typeof serviceClient>): Promise<boolean> {
  if (isSandboxSite()) return true;
  try {
    await getToken(svc);
    return true;
  } catch {
    return false;
  }
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

function linkResponse(
  link: { mindbody_client_id: string; mindbody_unique_id: string | null; link_method: string },
  accountStatus: string,
) {
  return {
    clientId: link.mindbody_client_id,
    uniqueId: link.mindbody_unique_id,
    linkMethod: link.link_method,
    accountStatus,
  };
}

async function mindbodyClientExists(mindbodyClientId: string): Promise<boolean> {
  const query = new URLSearchParams({
    'request.clientIds': mindbodyClientId,
    'request.includeInactive': 'true',
  });
  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${query.toString()}`,
  );
  return (response.Clients ?? []).some((client) => clientId(client) === mindbodyClientId);
}

async function createClient(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  email: string,
  profile: ProfileRow,
): Promise<{ client: MbClient; method: LinkMethod }> {
  if (!allowClientCreate()) {
    throw new MbError('NOT_LINKED', 'No matching Mindbody client found.');
  }

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

      return { client: response.Client, method: 'created' };
    } catch (error) {
      if (!isDuplicateClientError(error)) throw error;

      let repaired = false;
      const matches = filterByExactEmail(await searchClients(email), email);
      for (const client of matches) {
        const id = clientId(client);
        if (!id) continue;
        const owner = await getMindbodyLinkOwner(svc, id);
        if (!owner || owner === userId) continue;
        if (await repairMisassignedMindbodyEmail(svc, owner, client, email)) {
          repaired = true;
        }
      }

      if (repaired) continue;

      throw new MbError(
         'AMBIGUOUS_MATCH',
        'A Mindbody profile with this email already exists and belongs to another member. Ask the front desk to relink your account.',
      );
    }
  }

  throw new MbError('UPSTREAM_ERROR', 'Unable to create Mindbody client.');
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
    const user = await requireUser(req);
    const svc = serviceClient();

    // Check if already linked
    const { data: existing, error: existingError } = await svc
      .from('mindbody_links')
      .select('user_id, mindbody_client_id, mindbody_unique_id, linked_at, link_method')
      .eq('user_id', user.userId)
      .maybeSingle<MindbodyLinkRow>();

    if (existingError) throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody link.');
    if (existing) {
      const stillExists = await mindbodyClientExists(existing.mindbody_client_id);
      if (stillExists) {
        // Ensure profile is set to active
        await svc
          .from('profiles')
          .update({ account_status: 'active' })
          .eq('id', user.userId);
        return jsonResponse(linkResponse({
          mindbody_client_id: existing.mindbody_client_id,
          mindbody_unique_id: existing.mindbody_unique_id,
          link_method: existing.link_method,
        }, 'active'));
      }

      const { error: deleteError } = await svc
        .from('mindbody_links')
        .delete()
        .eq('user_id', user.userId);
      if (deleteError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to clear stale Mindbody link.');
      }
    }

    const profile = await ensureMemberProfile(svc, user.userId);

    const email = user.email.trim();
    if (!email) {
      throw new MbError('BAD_REQUEST', 'Account email is required before linking Mindbody.');
    }

    // 1. Search by exact email
    const emailClients = await searchClients(email);
    const emailMatches = filterByExactEmail(emailClients, email);
    const availableEmailClients = await getAvailableClients(svc, user.userId, email, emailMatches);

    let matchClient: MbClient | null = null;
    let matchBasis: 'email' | 'phone' = 'email';
    let matchCount = availableEmailClients.length;
    let rawMatches = availableEmailClients;

    if (availableEmailClients.length === 1) {
      matchClient = availableEmailClients[0];
      matchBasis = 'email';
    } else if (availableEmailClients.length === 0) {
      // 2. Fall back to phone if email has zero matches
      if (profile.phone) {
        const phone = profile.phone;
        const phoneClients = await searchClients(phone);
        const phoneMatches = filterByExactPhone(phoneClients, phone);
        const availablePhoneClients = await getAvailableClients(svc, user.userId, email, phoneMatches);

        matchCount = availablePhoneClients.length;
        rawMatches = availablePhoneClients;
        matchBasis = 'phone';

        if (availablePhoneClients.length === 1) {
          matchClient = availablePhoneClients[0];
        }
      }
    }

    // If no exact match, try creating client (only if allowClientCreate() is true, i.e. local/dev with permission)
    if (!matchClient && allowClientCreate()) {
      try {
        const created = await createClient(svc, user.userId, email, profile);
        matchClient = created.client;
        matchBasis = 'email';
        matchCount = 1;
        rawMatches = [created.client];
      } catch (_err) {
        // If creation fails, we still remain unlinked
      }
    }

    // Handle results
    if (matchClient) {
      // We have exactly one match!
      const mbClientId = clientId(matchClient);
      if (!mbClientId) {
        throw new MbError('UPSTREAM_ERROR', 'Mindbody client is missing an Id.');
      }

      await ensureClientLinkable(svc, user.userId, email, matchClient);

      const link = {
        user_id: user.userId,
        mindbody_client_id: mbClientId,
        mindbody_unique_id: uniqueId(matchClient),
        link_method: matchBasis === 'email' ? 'matched_email' as LinkMethod : 'matched_phone' as LinkMethod,
      };

      const { error: upsertError } = await svc.from('mindbody_links').upsert(link);
      if (upsertError) throw upsertLinkErrorMessage(upsertError);

      await svc
        .from('profiles')
        .update({
          mindbody_synced_at: new Date().toISOString(),
          account_status: 'active',
        })
        .eq('id', user.userId);

      // Log successful attempt
      await svc.from('mindbody_link_attempts').insert({
        user_id: user.userId,
        verified_email: email,
        verified_phone: profile.phone,
        match_basis: matchBasis,
        match_count: 1,
        status: 'linked',
        matched_mindbody_client_id: mbClientId,
        raw_matches: rawMatches,
      });

      return jsonResponse(
        linkResponse({
          mindbody_client_id: link.mindbody_client_id,
          mindbody_unique_id: link.mindbody_unique_id,
          link_method: link.link_method,
        }, 'active'),
      );
    } else {
      // No match or ambiguous matches!
      const autoLinkReady = await mindbodyAutoLinkReady(svc);

      if (matchCount === 0 && !autoLinkReady) {
        await svc.from('profiles')
          .update({ account_status: 'activation_required' })
          .eq('id', user.userId);

        await svc.from('mindbody_link_attempts').insert({
          user_id: user.userId,
          verified_email: email,
          verified_phone: profile.phone,
          match_basis: matchBasis,
          match_count: 0,
          status: 'failed',
          raw_matches: [{
            reason: 'mindbody_user_token_unavailable',
            note: 'Mindbody GetClients searchText requires a user token on production sites.',
          }],
        });

        throw new MbError(
          'MINDBODY_TOKEN_REQUIRED',
          'Auto-link is unavailable until Mindbody activates the API integration for this site. Ask the front desk to link your account manually.',
        );
      }

      const status = matchCount > 1 ? 'ambiguous' : 'activation_required';

      await svc.from('profiles')
        .update({ account_status: 'activation_required' })
        .eq('id', user.userId);

      // Log attempt
      await svc.from('mindbody_link_attempts').insert({
        user_id: user.userId,
        verified_email: email,
        verified_phone: profile.phone,
        match_basis: matchBasis,
        match_count: matchCount,
        status: status,
        raw_matches: rawMatches,
      });

      return jsonResponse({
        error: {
          code: matchCount > 1 ? 'AMBIGUOUS_MATCH' : 'NOT_LINKED',
          message: matchCount > 1
            ? 'Multiple Mindbody profiles found. Please contact the front desk to activate your account.'
            : 'No matching Mindbody profile found. Please contact the front desk to activate your account.',
          accountStatus: 'activation_required',
        }
      }, { status: 400 });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
});
