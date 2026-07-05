import { jsonResponse, withCors } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type AdminClientsRequest = {
  query?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
  clientId?: string;
  linkedFilter?: 'all' | 'linked' | 'unlinked';
  activeFilter?: 'all' | 'active' | 'inactive';
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Email?: unknown;
  MobilePhone?: unknown;
  HomePhone?: unknown;
  PhotoUrl?: unknown;
  Status?: unknown;
  Active?: unknown;
  BirthDate?: unknown;
  CreationDate?: unknown;
  LastModifiedDateTime?: unknown;
  AddressLine1?: unknown;
  AddressLine2?: unknown;
  City?: unknown;
  State?: unknown;
  PostalCode?: unknown;
  Country?: unknown;
  Gender?: unknown;
  EmergencyContactInfoName?: unknown;
  EmergencyContactInfoPhone?: unknown;
  Notes?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
  PaginationResponse?: {
    TotalResults?: unknown;
    RequestedLimit?: unknown;
    RequestedOffset?: unknown;
  };
};

type LinkRow = {
  user_id: string;
  mindbody_client_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_status: string | null;
  membership_status: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type PointsRow = {
  user_id: string;
  balance: number | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clientIdOf(client: MbClient): string | null {
  return asString(client.Id);
}

function clientName(client: MbClient): string {
  const first = asString(client.FirstName)?.trim() ?? '';
  const last = asString(client.LastName)?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Member';
}

function clientPhone(client: MbClient): string | null {
  const phone =
    asString(client.MobilePhone)?.trim() ||
    asString(client.HomePhone)?.trim() ||
    null;
  return phone || null;
}

function normalizeClient(client: MbClient) {
  const mindbodyClientId = clientIdOf(client);
  if (!mindbodyClientId) return null;

  return {
    mindbodyClientId,
    mindbodyUniqueId: asString(client.UniqueId),
    firstName: asString(client.FirstName)?.trim() ?? '',
    lastName: asString(client.LastName)?.trim() ?? '',
    fullName: clientName(client),
    email: asString(client.Email)?.trim().toLowerCase() ?? null,
    phone: clientPhone(client),
    photoUrl: asString(client.PhotoUrl)?.trim() ?? null,
    status: asString(client.Status)?.trim() ?? null,
    active: asBoolean(client.Active, true),
    birthDate: asString(client.BirthDate),
    createdAt: asString(client.CreationDate),
    lastModifiedAt: asString(client.LastModifiedDateTime),
    addressLine1: asString(client.AddressLine1),
    addressLine2: asString(client.AddressLine2),
    city: asString(client.City),
    state: asString(client.State),
    postalCode: asString(client.PostalCode),
    country: asString(client.Country),
    gender: asString(client.Gender),
    emergencyContactName: asString(client.EmergencyContactInfoName),
    emergencyContactPhone: asString(client.EmergencyContactInfoPhone),
    notes: asString(client.Notes),
    appUserId: null as string | null,
    appFullName: null as string | null,
    appRole: null as string | null,
    appAccountStatus: null as string | null,
    appMembershipStatus: null as string | null,
    appAvatarUrl: null as string | null,
    appCreatedAt: null as string | null,
    pointsBalance: null as number | null,
    attendanceCount: null as number | null,
  };
}

type NormalizedClient = NonNullable<ReturnType<typeof normalizeClient>>;

async function fetchMindbodyClients(
  query: string | null,
  limit: number,
  offset: number,
  includeInactive: boolean,
  clientId: string | null,
): Promise<{ clients: MbClient[]; total: number }> {
  const params = new URLSearchParams();
  params.set('request.limit', String(limit));
  params.set('request.offset', String(offset));
  params.set('request.includeInactive', includeInactive ? 'true' : 'false');

  if (clientId) {
    params.set('request.clientIDs', clientId);
  } else if (query) {
    params.set('request.searchText', query);
  }

  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${params.toString()}`,
  );

  const totalRaw = response.PaginationResponse?.TotalResults;
  const total =
    typeof totalRaw === 'number' && Number.isFinite(totalRaw)
      ? totalRaw
      : (response.Clients ?? []).length;

  return {
    clients: response.Clients ?? [],
    total,
  };
}

async function enrichWithAppData(clients: NormalizedClient[]): Promise<NormalizedClient[]> {
  if (clients.length === 0) return clients;

  const svc = serviceClient();
  const clientIds = clients.map((client) => client.mindbodyClientId);

  const { data: links, error: linkError } = await svc
    .from('mindbody_links')
    .select('user_id, mindbody_client_id')
    .in('mindbody_client_id', clientIds);

  if (linkError) throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody links.');

  const linkMap = new Map<string, string>();
  for (const link of (links ?? []) as LinkRow[]) {
    linkMap.set(link.mindbody_client_id, link.user_id);
  }

  const userIds = [...new Set(linkMap.values())];
  if (userIds.length === 0) return clients;

  const [profilesResult, pointsResult] = await Promise.all([
    svc
      .from('profiles')
      .select(
        'id, full_name, role, account_status, membership_status, phone, avatar_url, created_at',
      )
      .in('id', userIds),
    svc.from('points_accounts').select('user_id, balance').in('user_id', userIds),
  ]);

  if (profilesResult.error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read linked app profiles.');
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profilesResult.data ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const pointsMap = new Map<string, number>();
  for (const row of (pointsResult.data ?? []) as PointsRow[]) {
    pointsMap.set(row.user_id, row.balance ?? 0);
  }

  return clients.map((client) => {
    const appUserId = linkMap.get(client.mindbodyClientId) ?? null;
    if (!appUserId) return client;

    const profile = profileMap.get(appUserId);
    return {
      ...client,
      appUserId,
      appFullName: profile?.full_name ?? null,
      appRole: profile?.role ?? null,
      appAccountStatus: profile?.account_status ?? null,
      appMembershipStatus: profile?.membership_status ?? null,
      appAvatarUrl: profile?.avatar_url ?? null,
      appCreatedAt: profile?.created_at ?? null,
      pointsBalance: pointsMap.get(appUserId) ?? 0,
      attendanceCount: null,
    };
  });
}

function applyLinkedFilter(
  clients: NormalizedClient[],
  linkedFilter: AdminClientsRequest['linkedFilter'],
): NormalizedClient[] {
  if (linkedFilter === 'linked') {
    return clients.filter((client) => Boolean(client.appUserId));
  }
  if (linkedFilter === 'unlinked') {
    return clients.filter((client) => !client.appUserId);
  }
  return clients;
}

function applyActiveFilter(
  clients: NormalizedClient[],
  activeFilter: AdminClientsRequest['activeFilter'],
): NormalizedClient[] {
  if (activeFilter === 'active') return clients.filter((client) => client.active);
  if (activeFilter === 'inactive') return clients.filter((client) => !client.active);
  return clients;
}

Deno.serve((req) =>
  withCors(req, async () => {
    if (req.method !== 'POST') {
      return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
    }

    try {
      const caller = await requireUser(req);
      requireRole(caller, ['admin']);

      const body = (await req.json().catch(() => ({}))) as AdminClientsRequest;
      const query = body.query?.trim() || null;
      const clientId = body.clientId?.trim() || null;
      const limit = Math.max(1, Math.min(body.limit ?? 20, 50));
      const offset = Math.max(0, body.offset ?? 0);
      const includeInactive = body.includeInactive ?? true;
      const linkedFilter = body.linkedFilter ?? 'all';
      const activeFilter = body.activeFilter ?? 'all';

      const { clients: rawClients, total } = await fetchMindbodyClients(
        query,
        clientId ? 1 : limit,
        clientId ? 0 : offset,
        includeInactive,
        clientId,
      );

      const normalized = rawClients
        .map((client) => normalizeClient(client))
        .filter((client): client is NormalizedClient => Boolean(client));

      const enriched = applyActiveFilter(
        applyLinkedFilter(await enrichWithAppData(normalized), linkedFilter),
        activeFilter,
      );

      return jsonResponse({
        clients: enriched,
        total: linkedFilter === 'all' && activeFilter === 'all' ? total : enriched.length,
        limit,
        offset,
        query,
        linkedFilter,
        activeFilter,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return toErrorResponse(error, req);
    }
  }),
);
