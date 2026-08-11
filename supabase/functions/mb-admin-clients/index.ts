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
  membershipFilter?: 'all' | 'active' | 'inactive';
  orderBy?: 'recent' | 'points';
  roleFilter?: 'admin' | 'coach' | 'member' | 'guest' | null;
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

type AppDirectoryRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  account_status: string | null;
  membership_status: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  email: string | null;
  mindbody_client_id: string | null;
  points_balance: number | null;
  total_count: number | null;
};

const MAX_SCAN_PAGES = 40;
const SCAN_PAGE_SIZE = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function isActiveMembership(status: string | null | undefined): boolean {
  const normalized = status?.trim().toLowerCase();
  return normalized === 'active' || normalized === 'current';
}

function applyMembershipFilter(
  clients: NormalizedClient[],
  membershipFilter: AdminClientsRequest['membershipFilter'],
): NormalizedClient[] {
  if (membershipFilter === 'active') {
    return clients.filter((client) => isActiveMembership(client.appMembershipStatus));
  }
  if (membershipFilter === 'inactive') {
    return clients.filter((client) => client.appUserId && !isActiveMembership(client.appMembershipStatus));
  }
  return clients;
}

function sortClients(
  clients: NormalizedClient[],
  orderBy: AdminClientsRequest['orderBy'],
): NormalizedClient[] {
  const sorted = [...clients];

  if (orderBy === 'points') {
    return sorted.sort((a, b) => (b.pointsBalance ?? 0) - (a.pointsBalance ?? 0));
  }

  return sorted.sort((a, b) => {
    const bDate = b.appCreatedAt ?? b.createdAt ?? '';
    const aDate = a.appCreatedAt ?? a.createdAt ?? '';
    return bDate.localeCompare(aDate);
  });
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

async function fetchMindbodyClientsByIds(clientIds: string[]): Promise<MbClient[]> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const results: MbClient[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < unique.length; offset += 50) {
    const chunk = unique.slice(offset, offset + 50);
    const params = new URLSearchParams();
    params.set('request.limit', String(Math.max(chunk.length, 1)));
    params.set('request.offset', '0');
    params.set('request.clientIDs', chunk.join(','));
    params.set('request.includeInactive', 'true');

    const response = await mbFetch<ClientSearchResponse>(
      serviceClient(),
      `/client/clients?${params.toString()}`,
    );

    for (const client of response.Clients ?? []) {
      const id = clientIdOf(client);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      results.push(client);
    }
  }

  const missing = unique.filter((id) => !seen.has(id));
  await Promise.all(
    missing.map(async (clientId) => {
      const params = new URLSearchParams();
      params.set('request.limit', '1');
      params.set('request.offset', '0');
      params.set('request.clientIDs', clientId);
      params.set('request.includeInactive', 'true');

      const response = await mbFetch<ClientSearchResponse>(
        serviceClient(),
        `/client/clients?${params.toString()}`,
      );
      for (const client of response.Clients ?? []) {
        const id = clientIdOf(client);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        results.push(client);
      }
    }),
  );

  return results;
}

/**
 * Resolve app user IDs whose auth.users email matches `query`.
 * Needed when activation linked via phone/manual and Mindbody email ≠ app email.
 */
async function findAppUserIdsByEmail(query: string): Promise<string[]> {
  const svc = serviceClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const userIds = new Set<string>();

  // Exact match (fast path for full email paste).
  const { data: exactId, error: exactError } = await svc.rpc('get_auth_user_id_by_email', {
    p_email: trimmed,
  });
  if (exactError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to look up app users by email.');
  }
  if (typeof exactId === 'string' && exactId) userIds.add(exactId);

  // Partial / ilike match for substrings of the signup email.
  const { data: patternRows, error: patternError } = await svc.rpc('find_user_ids_by_email_pattern', {
    p_query: trimmed,
    p_limit: 50,
  });
  if (patternError) {
    // RPC may not be migrated yet — exact match alone still helps.
    console.warn('find_user_ids_by_email_pattern unavailable:', patternError.message);
  } else {
    for (const row of (patternRows ?? []) as Array<{ id?: string } | string>) {
      const id = typeof row === 'string' ? row : row.id;
      if (id) userIds.add(id);
    }
  }

  return [...userIds];
}

async function mergeAppAndMindbodyMatches(
  query: string | null,
  mbClients: NormalizedClient[],
  mbTotal: number,
  offset: number,
  limit: number,
  activeFilter: AdminClientsRequest['activeFilter'],
  membershipFilter: AdminClientsRequest['membershipFilter'],
  orderBy: AdminClientsRequest['orderBy'],
): Promise<{ clients: NormalizedClient[]; total: number }> {
  if (!query) {
    const clients = sortClients(
      applyMembershipFilter(applyActiveFilter(await enrichWithAppData(mbClients), activeFilter), membershipFilter),
      orderBy,
    );
    return {
      clients,
      total: mbTotal,
    };
  }

  const svc = serviceClient();
  const pattern = `%${query}%`;

  // Search local profiles/links/emails matching search query
  const [{ data: byName }, { data: byPhone }, { data: byProfileId }, { data: byClientId }, emailUserIds] =
    await Promise.all([
      svc.from('profiles').select('id').ilike('full_name', pattern).limit(100),
      svc.from('profiles').select('id').ilike('phone', pattern).limit(100),
      UUID_PATTERN.test(query)
        ? svc.from('profiles').select('id').eq('id', query).limit(1)
        : Promise.resolve({ data: [] }),
      svc
        .from('mindbody_links')
        .select('user_id')
        .ilike('mindbody_client_id', pattern)
        .limit(100),
      findAppUserIdsByEmail(query),
    ]);

  const matchedUserIds = new Set<string>();
  if (byName) for (const row of byName) matchedUserIds.add(row.id);
  if (byPhone) for (const row of byPhone) matchedUserIds.add(row.id);
  if (byProfileId) for (const row of byProfileId) matchedUserIds.add(row.id);
  if (byClientId) for (const row of byClientId) matchedUserIds.add(row.user_id);
  for (const id of emailUserIds) matchedUserIds.add(id);

  let appMatches: NormalizedClient[] = [];
  if (matchedUserIds.size > 0) {
    const matchedList = [...matchedUserIds];
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name, role, account_status, membership_status, phone, avatar_url, created_at')
      .in('id', matchedList);

    if (profiles && profiles.length > 0) {
      const pageUserIds = profiles.map(p => p.id);
      const [{ data: links }, { data: points }, { data: emails }] = await Promise.all([
        svc.from('mindbody_links').select('user_id, mindbody_client_id').in('user_id', pageUserIds),
        svc.from('points_accounts').select('user_id, balance').in('user_id', pageUserIds),
        svc.rpc('admin_get_users_emails', { p_user_ids: pageUserIds }),
      ]);

      const linkMap = new Map<string, string>();
      if (links) for (const row of links) linkMap.set(row.user_id, row.mindbody_client_id);

      const pointsMap = new Map<string, number>();
      if (points) for (const row of points) pointsMap.set(row.user_id, row.balance ?? 0);

      const emailMap = new Map<string, string>();
      if (emails) for (const row of emails) emailMap.set(row.id, row.email);

      const clientIds = profiles
        .map((p) => linkMap.get(p.id))
        .filter((id): id is string => Boolean(id));

      let mbFetched: MbClient[] = [];
      try {
        if (clientIds.length > 0) {
          mbFetched = await fetchMindbodyClientsByIds(clientIds);
        }
      } catch (err) {
        console.error('Failed to fetch Mindbody clients for search matches:', err);
      }

      const mbMap = new Map<string, MbClient>();
      for (const client of mbFetched) {
        const cid = clientIdOf(client);
        if (cid) mbMap.set(cid, client);
      }

      appMatches = profiles.map((p) => {
        const mbClientId = linkMap.get(p.id) ?? null;
        const mbClient = mbClientId ? mbMap.get(mbClientId) : null;
        return {
          mindbodyClientId: mbClientId,
          mindbodyUniqueId: mbClient ? asString(mbClient.UniqueId) : null,
          firstName: mbClient ? (asString(mbClient.FirstName)?.trim() ?? '') : (p.full_name?.split(' ')[0] ?? ''),
          lastName: mbClient ? (asString(mbClient.LastName)?.trim() ?? '') : (p.full_name?.split(' ').slice(1).join(' ') ?? ''),
          fullName: mbClient ? clientName(mbClient) : (p.full_name ?? 'Member'),
          email: mbClient ? (asString(mbClient.Email)?.trim().toLowerCase() ?? null) : (emailMap.get(p.id) ?? null),
          phone: mbClient ? clientPhone(mbClient) : (p.phone ?? null),
          photoUrl: mbClient ? (asString(mbClient.PhotoUrl)?.trim() ?? null) : (p.avatar_url ?? null),
          status: mbClient ? (asString(mbClient.Status)?.trim() ?? null) : null,
          active: mbClient ? asBoolean(mbClient.Active, true) : true,
          birthDate: mbClient ? asString(mbClient.BirthDate) : null,
          createdAt: mbClient ? asString(mbClient.CreationDate) : null,
          lastModifiedAt: mbClient ? asString(mbClient.LastModifiedDateTime) : null,
          addressLine1: mbClient ? asString(mbClient.AddressLine1) : null,
          addressLine2: mbClient ? asString(mbClient.AddressLine2) : null,
          city: mbClient ? asString(mbClient.City) : null,
          state: mbClient ? asString(mbClient.State) : null,
          postalCode: mbClient ? asString(mbClient.PostalCode) : null,
          country: mbClient ? asString(mbClient.Country) : null,
          gender: mbClient ? asString(mbClient.Gender) : null,
          emergencyContactName: mbClient ? asString(mbClient.EmergencyContactInfoName) : null,
          emergencyContactPhone: mbClient ? asString(mbClient.EmergencyContactInfoPhone) : null,
          notes: mbClient ? asString(mbClient.Notes) : null,
          appUserId: p.id,
          appFullName: p.full_name,
          appRole: p.role as any,
          appAccountStatus: p.account_status,
          appMembershipStatus: p.membership_status,
          appAvatarUrl: p.avatar_url,
          appCreatedAt: p.created_at,
          pointsBalance: pointsMap.get(p.id) ?? 0,
          attendanceCount: null,
        };
      });
    }
  }

  // Enrich Mindbody clients returned from Mindbody search
  const enrichedMb = await enrichWithAppData(mbClients);

  // Merge the two lists, deduping by mindbodyClientId or appUserId
  const seen = new Set<string>();
  const merged: NormalizedClient[] = [];

  // Add app matches first so they take priority
  for (const client of appMatches) {
    const key = client.mindbodyClientId ? `mb-${client.mindbodyClientId}` : `app-${client.appUserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(client);
  }

  for (const client of enrichedMb) {
    const key = client.mindbodyClientId ? `mb-${client.mindbodyClientId}` : `app-${client.appUserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(client);
  }

  const filtered = sortClients(
    applyMembershipFilter(applyActiveFilter(merged, activeFilter), membershipFilter),
    orderBy,
  );
  const total =
    activeFilter === 'all' && membershipFilter === 'all'
      ? mbTotal + (merged.length - enrichedMb.length)
      : filtered.length;

  return {
    clients: filtered.slice(offset, offset + limit),
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

async function countLinkedMembers(roleFilter: string | null): Promise<number> {
  const svc = serviceClient();

  if (!roleFilter) {
    const { count, error } = await svc
      .from('mindbody_links')
      .select('user_id', { count: 'exact', head: true });
    if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to count linked members.');
    return count ?? 0;
  }

  const { data: profiles, error: profileError } = await svc
    .from('profiles')
    .select('id')
    .eq('role', roleFilter);
  if (profileError) throw new MbError('UPSTREAM_ERROR', 'Unable to read role profiles.');

  const userIds = ((profiles ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (userIds.length === 0) return 0;

  const { count, error } = await svc
    .from('mindbody_links')
    .select('user_id', { count: 'exact', head: true })
    .in('user_id', userIds);
  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to count linked members.');
  return count ?? 0;
}

async function fetchAppDirectoryPage(input: {
  query: string | null;
  limit: number;
  offset: number;
  activeFilter: 'all' | 'active' | 'inactive';
  membershipFilter: 'all' | 'active' | 'inactive';
  orderBy: 'recent' | 'points';
  linkedFilter: 'all' | 'linked' | 'unlinked';
  roleFilter: string | null;
}): Promise<{ clients: NormalizedClient[]; total: number }> {
  const svc = serviceClient();

  const { data, error } = await svc.rpc('admin_list_app_member_directory', {
    p_query: input.query,
    p_limit: input.limit,
    p_offset: input.offset,
    p_role: input.roleFilter,
    p_linked_filter: input.linkedFilter,
    p_membership_filter: input.membershipFilter,
    p_order: input.orderBy,
  });

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to read member directory: ${error.message}`);
  }

  const rows = (data ?? []) as AppDirectoryRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  if (rows.length === 0) return { clients: [], total };

  const clientIds = rows
    .map((row) => row.mindbody_client_id)
    .filter((id): id is string => Boolean(id));

  let mbClients: MbClient[] = [];
  try {
    if (clientIds.length > 0) {
      mbClients = await fetchMindbodyClientsByIds(clientIds);
    }
  } catch (err) {
    console.error('Failed to fetch Mindbody clients in fetchAppDirectoryPage:', err);
  }

  const mbMap = new Map<string, MbClient>();
  for (const client of mbClients) {
    const cid = clientIdOf(client);
    if (cid) mbMap.set(cid, client);
  }

  const result: NormalizedClient[] = rows.map((row) => {
    const mbClientId = row.mindbody_client_id;
    const mbClient = mbClientId ? mbMap.get(mbClientId) : null;

    return {
      mindbodyClientId: mbClientId,
      mindbodyUniqueId: mbClient ? asString(mbClient.UniqueId) : null,
      firstName: mbClient ? (asString(mbClient.FirstName)?.trim() ?? '') : (row.full_name?.split(' ')[0] ?? ''),
      lastName: mbClient ? (asString(mbClient.LastName)?.trim() ?? '') : (row.full_name?.split(' ').slice(1).join(' ') ?? ''),
      fullName: mbClient ? clientName(mbClient) : (row.full_name ?? 'Member'),
      email: mbClient ? (asString(mbClient.Email)?.trim().toLowerCase() ?? null) : row.email,
      phone: mbClient ? clientPhone(mbClient) : row.phone,
      photoUrl: mbClient ? (asString(mbClient.PhotoUrl)?.trim() ?? null) : row.avatar_url,
      status: mbClient ? (asString(mbClient.Status)?.trim() ?? null) : null,
      active: mbClient ? asBoolean(mbClient.Active, true) : true,
      birthDate: mbClient ? asString(mbClient.BirthDate) : null,
      createdAt: mbClient ? asString(mbClient.CreationDate) : null,
      lastModifiedAt: mbClient ? asString(mbClient.LastModifiedDateTime) : null,
      addressLine1: mbClient ? asString(mbClient.AddressLine1) : null,
      addressLine2: mbClient ? asString(mbClient.AddressLine2) : null,
      city: mbClient ? asString(mbClient.City) : null,
      state: mbClient ? asString(mbClient.State) : null,
      postalCode: mbClient ? asString(mbClient.PostalCode) : null,
      country: mbClient ? asString(mbClient.Country) : null,
      gender: mbClient ? asString(mbClient.Gender) : null,
      emergencyContactName: mbClient ? asString(mbClient.EmergencyContactInfoName) : null,
      emergencyContactPhone: mbClient ? asString(mbClient.EmergencyContactInfoPhone) : null,
      notes: mbClient ? asString(mbClient.Notes) : null,
      appUserId: row.user_id,
      appFullName: row.full_name,
      appRole: row.role as any,
      appAccountStatus: row.account_status,
      appMembershipStatus: row.membership_status,
      appAvatarUrl: row.avatar_url,
      appCreatedAt: row.created_at,
      pointsBalance: row.points_balance ?? 0,
      attendanceCount: null,
    };
  });

  const filtered = applyMembershipFilter(applyActiveFilter(result, input.activeFilter), input.membershipFilter);

  return {
    clients: filtered,
    total,
  };
}

async function fetchFilteredMindbodyPage(input: {
  query: string | null;
  limit: number;
  offset: number;
  includeInactive: boolean;
  linkedFilter: 'all' | 'unlinked';
  activeFilter: 'all' | 'active' | 'inactive';
  orderBy: 'recent' | 'points' | 'name';
}): Promise<{ clients: NormalizedClient[]; total: number }> {
  const matched: NormalizedClient[] = [];
  let skipped = 0;
  let mbOffset = 0;
  let mbTotal = Number.POSITIVE_INFINITY;
  let pages = 0;

  while (matched.length < input.limit && mbOffset < mbTotal && pages < MAX_SCAN_PAGES) {
    const { clients: rawClients, total } = await fetchMindbodyClients(
      input.query,
      SCAN_PAGE_SIZE,
      mbOffset,
      input.includeInactive,
      null,
    );
    mbTotal = total;
    pages += 1;
    mbOffset += SCAN_PAGE_SIZE;

    if (rawClients.length === 0) break;

    const normalized = rawClients
      .map((client) => normalizeClient(client))
      .filter((client): client is NormalizedClient => Boolean(client));

    let enriched = await enrichWithAppData(normalized);
    enriched = applyLinkedFilter(enriched, input.linkedFilter);
    enriched = applyActiveFilter(enriched, input.activeFilter);

    for (const client of enriched) {
      if (skipped < input.offset) {
        skipped += 1;
        continue;
      }
      matched.push(client);
      if (matched.length >= input.limit) break;
    }
  }

  const linkedCount = await countLinkedMembers(null);
  let estimatedTotal: number;
  if (input.linkedFilter === 'unlinked' && input.activeFilter === 'all' && !input.query) {
    estimatedTotal = Math.max(0, (Number.isFinite(mbTotal) ? mbTotal : 0) - linkedCount);
  } else if (input.activeFilter === 'inactive' && input.linkedFilter === 'all' && !input.query) {
    // Best-effort: scanned matches plus remaining unknown pages.
    estimatedTotal = Math.max(matched.length + input.offset, matched.length);
  } else {
    estimatedTotal = matched.length + input.offset;
  }

  return { clients: sortClients(matched, input.orderBy), total: estimatedTotal };
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
      const membershipFilter = body.membershipFilter ?? 'all';
      const orderBy = body.orderBy ?? 'recent';
      const roleFilter = body.roleFilter ?? null;

      if (clientId) {
        const { clients: rawClients } = await fetchMindbodyClients(null, 1, 0, true, clientId);
        const normalized = rawClients
          .map((client) => normalizeClient(client))
          .filter((client): client is NormalizedClient => Boolean(client));
        const enriched = await enrichWithAppData(normalized);
        return jsonResponse({
          clients: enriched,
          total: enriched.length,
          limit,
          offset: 0,
          query,
          linkedFilter,
          activeFilter,
          membershipFilter,
          orderBy,
          roleFilter,
          fetchedAt: new Date().toISOString(),
        });
      }

      // Linked, role, and membership filters must page from profiles database.
      if (linkedFilter !== 'all' || roleFilter || membershipFilter !== 'all') {
        const page = await fetchAppDirectoryPage({
          query,
          limit,
          offset,
          activeFilter,
          membershipFilter,
          orderBy,
          linkedFilter,
          roleFilter,
        });
        return jsonResponse({
          clients: page.clients,
          total: page.total,
          limit,
          offset,
          query,
          linkedFilter,
          activeFilter,
          membershipFilter,
          orderBy,
          roleFilter,
          fetchedAt: new Date().toISOString(),
        });
      }

      // Unlinked or inactive: scan Mindbody pages until this page is filled.
      if (linkedFilter === 'unlinked' || activeFilter === 'inactive') {
        const page = await fetchFilteredMindbodyPage({
          query,
          limit,
          offset,
          includeInactive: linkedFilter === 'unlinked' ? includeInactive : true,
          linkedFilter: linkedFilter === 'unlinked' ? 'unlinked' : 'all',
          activeFilter,
          orderBy,
        });
        return jsonResponse({
          clients: page.clients,
          total: page.total,
          limit,
          offset,
          query,
          linkedFilter,
          activeFilter,
          membershipFilter,
          orderBy,
          roleFilter,
          fetchedAt: new Date().toISOString(),
        });
      }

      const { clients: rawClients, total } = await fetchMindbodyClients(
        query,
        limit,
        offset,
        includeInactive,
        null,
      );

      const normalized = rawClients
        .map((client) => normalizeClient(client))
        .filter((client): client is NormalizedClient => Boolean(client));

      const merged = await mergeAppAndMindbodyMatches(
        query,
        normalized,
        total,
        offset,
        limit,
        activeFilter,
        membershipFilter,
        orderBy,
      );

      return jsonResponse({
        clients: merged.clients,
        total: merged.total,
        limit,
        offset,
        query,
        linkedFilter,
        activeFilter,
        membershipFilter,
        orderBy,
        roleFilter,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return toErrorResponse(error, req);
    }
  }),
);
