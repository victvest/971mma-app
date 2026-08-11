import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet, mbFetch } from '../_shared/mindbody.ts';
import { serviceClient, userClient } from '../_shared/supabase.ts';

const ROSTER_TTL_SEC = 60;
const GYM_TZ = 'Asia/Dubai';

type RosterRequest = {
  classId?: string;
  mindbodyClassId?: string;
  force?: boolean;
};

type MbClient = {
  Id?: unknown;
  ClientId?: unknown;
  UniqueId?: unknown;
  Name?: unknown;
  DisplayName?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  PhotoUrl?: unknown;
  ImageUrl?: unknown;
  SignedIn?: unknown;
  SignedInStatus?: unknown;
};

type MbVisit = MbClient & {
  Client?: MbClient;
};

type MbClassVisits = {
  Class?: {
    Id?: unknown;
    Clients?: MbClient[];
    Visits?: MbVisit[];
    TotalBooked?: unknown;
  };
  Visits?: MbVisit[];
};

type ClassRow = {
  id: string;
  mindbody_class_id: string | null;
  title: string;
  starts_at: string;
};

type LinkRow = {
  user_id: string;
  mindbody_client_id: string;
};

type CheckInRow = {
  user_id: string;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function clientIdOf(client: MbClient, options: { allowIdFallback?: boolean } = {}): string | null {
  const clientId = asString(client.ClientId);
  if (clientId) return clientId;
  if (options.allowIdFallback) return asString(client.Id);
  return null;
}

function mindbodyClientName(client: MbClient): string {
  const display = asString(client.DisplayName)?.trim();
  if (display) return display;

  const first = asString(client.FirstName)?.trim() ?? '';
  const last = asString(client.LastName)?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Member';
}

function mindbodyPhotoUrl(client: MbClient): string | null {
  return asString(client.PhotoUrl)?.trim() || asString(client.ImageUrl)?.trim() || null;
}

function isSignedIn(client: MbClient): boolean {
  if (typeof client.SignedIn === 'boolean') return client.SignedIn;
  const status = asString(client.SignedInStatus)?.toLowerCase();
  return status === 'signedin' || status === 'true';
}

function flattenVisitClients(page: MbClassVisits): MbClient[] {
  if (page.Class?.Clients?.length) {
    return page.Class.Clients.map((client) => ({
      ...client,
      ClientId: client.ClientId ?? client.Id,
    }));
  }

  const visits = page.Visits ?? page.Class?.Visits ?? [];
  return visits.map((visit) => {
    const nested = visit.Client;
    if (nested && typeof nested === 'object') {
      return {
        ...nested,
        ClientId: nested.ClientId ?? visit.ClientId ?? nested.Id,
        DisplayName: nested.DisplayName,
        FirstName: nested.FirstName ?? visit.FirstName,
        LastName: nested.LastName ?? visit.LastName,
        PhotoUrl: nested.PhotoUrl ?? visit.PhotoUrl,
        ImageUrl: nested.ImageUrl ?? visit.ImageUrl,
        SignedIn: visit.SignedIn ?? nested.SignedIn,
        SignedInStatus: visit.SignedInStatus ?? nested.SignedInStatus,
      };
    }

    return {
      ClientId: visit.ClientId,
      FirstName: visit.FirstName,
      LastName: visit.LastName,
      DisplayName: visit.DisplayName,
      PhotoUrl: visit.PhotoUrl,
      ImageUrl: visit.ImageUrl,
      SignedIn: visit.SignedIn,
      SignedInStatus: visit.SignedInStatus,
    };
  });
}

async function fetchClientDetailsMap(
  svc: ReturnType<typeof serviceClient>,
  clientIds: string[],
): Promise<Map<string, { name: string; photoUrl: string | null }>> {
  const map = new Map<string, { name: string; photoUrl: string | null }>();
  const unique = [...new Set(clientIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const ingestClients = (clients: MbClient[]) => {
    for (const client of clients) {
      const id = clientIdOf(client, { allowIdFallback: true });
      if (!id) continue;
      map.set(id, {
        name: mindbodyClientName(client),
        photoUrl: mindbodyPhotoUrl(client),
      });
    }
  };

  for (let offset = 0; offset < unique.length; offset += 50) {
    const chunk = unique.slice(offset, offset + 50);
    const params = new URLSearchParams();
    params.set('request.limit', String(Math.max(chunk.length, 1)));
    params.set('request.offset', '0');
    params.set('request.clientIDs', chunk.join(','));
    params.set('request.includeInactive', 'true');

    const response = await mbFetch<ClientSearchResponse>(
      svc,
      `/client/clients?${params.toString()}`,
    );
    ingestClients(response.Clients ?? []);
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (clientId) => {
        const params = new URLSearchParams();
        params.set('request.limit', '1');
        params.set('request.offset', '0');
        params.set('request.clientIDs', clientId);
        params.set('request.includeInactive', 'true');

        const response = await mbFetch<ClientSearchResponse>(
          svc,
          `/client/clients?${params.toString()}`,
        );
        ingestClients(response.Clients ?? []);
      }),
    );
  }

  return map;
}

function gymTodayBounds(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TZ }).format(new Date());
  return {
    start: new Date(`${today}T00:00:00+04:00`).toISOString(),
    end: new Date(`${today}T23:59:59.999+04:00`).toISOString(),
  };
}

async function resolveClass(
  svc: ReturnType<typeof serviceClient>,
  body: RosterRequest,
): Promise<ClassRow> {
  if (body.classId) {
    const { data, error } = await svc
      .from('classes')
      .select('id, mindbody_class_id, title, starts_at')
      .eq('id', body.classId)
      .maybeSingle<ClassRow>();

    if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read class.');
    if (!data) throw new MbError('NOT_FOUND', 'Class not found.');
    if (!data.mindbody_class_id) {
      throw new MbError('NOT_FOUND', 'Class is not linked to Mindbody.');
    }
    return data;
  }

  const mindbodyClassId = body.mindbodyClassId?.trim();
  if (!mindbodyClassId) {
    throw new MbError('BAD_REQUEST', 'classId or mindbodyClassId is required.');
  }

  const { data, error } = await svc
    .from('classes')
    .select('id, mindbody_class_id, title, starts_at')
    .eq('mindbody_class_id', mindbodyClassId)
    .maybeSingle<ClassRow>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read class.');
  if (data) return data;

  return {
    id: '',
    mindbody_class_id: mindbodyClassId,
    title: 'Class',
    starts_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const caller = await requireUser(req);
    requireRole(caller, ['coach', 'admin']);

    const body = (await req.json().catch(() => ({}))) as RosterRequest;
    const svc = serviceClient();
    const classRow = await resolveClass(svc, body);
    const mindbodyClassId = classRow.mindbody_class_id!;

    if (classRow.id) {
      const userSvc = userClient(req);
      const { error: accessError } = await userSvc.rpc('assert_coach_class_access', {
        p_class_id: classRow.id,
      });
      if (accessError) {
        const message = accessError.message ?? 'Coach is not assigned to this class.';
        if (message.includes('FORBIDDEN') || message.includes('not assigned')) {
          throw new MbError('FORBIDDEN', message);
        }
        throw new MbError('UPSTREAM_ERROR', message);
      }
    }

    const cacheKey = `classvisits:v3:${mindbodyClassId}`;
    if (!body.force) {
      const cached = await cacheGet<{
        classId: string;
        mindbodyClassId: string;
        title: string;
        startsAt: string;
        visitors: unknown[];
        cached: boolean;
      }>(svc, cacheKey);
      if (cached) return jsonResponse({ ...cached, cached: true });
    }

    const query = new URLSearchParams({ 'request.classID': mindbodyClassId });
    const page = await mbFetch<MbClassVisits>(svc, `/class/classvisits?${query.toString()}`);
    const rawClients = flattenVisitClients(page);

    const clientIds = rawClients
      .map((client) => clientIdOf(client, { allowIdFallback: true }))
      .filter((value): value is string => Boolean(value));

    const clientDetails = await fetchClientDetailsMap(svc, clientIds);

    const linkMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: links, error: linkError } = await svc
        .from('mindbody_links')
        .select('user_id, mindbody_client_id')
        .in('mindbody_client_id', clientIds);

      if (linkError) throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody links.');
      for (const link of (links ?? []) as LinkRow[]) {
        linkMap.set(link.mindbody_client_id, link.user_id);
      }
    }

    const linkedUserIds = [...new Set(linkMap.values())];
    const localCheckedIn = new Set<string>();

    if (linkedUserIds.length > 0) {
      const { start, end } = gymTodayBounds();
      let checkInQuery = svc
        .from('check_ins')
        .select('user_id')
        .in('user_id', linkedUserIds)
        .gte('checked_in_at', start)
        .lte('checked_in_at', end);

      if (classRow.id) {
        checkInQuery = checkInQuery.eq('class_id', classRow.id);
      }

      const { data: checkIns, error: checkInError } = await checkInQuery;
      if (checkInError) throw new MbError('UPSTREAM_ERROR', 'Unable to read local check-ins.');
      for (const row of (checkIns ?? []) as CheckInRow[]) {
        localCheckedIn.add(row.user_id);
      }
    }

    const visitors = rawClients.map((client) => {
      const mindbodyClientId =
        clientIdOf(client, { allowIdFallback: true }) ?? '';
      const details = mindbodyClientId ? clientDetails.get(mindbodyClientId) : undefined;
      const userId = mindbodyClientId ? (linkMap.get(mindbodyClientId) ?? null) : null;
      return {
        mindbodyClientId,
        name: details?.name ?? mindbodyClientName(client),
        photoUrl: details?.photoUrl ?? mindbodyPhotoUrl(client),
        signedInMindbody: isSignedIn(client),
        userId,
        checkedInLocally: userId ? localCheckedIn.has(userId) : false,
      };
    });

    const payload = {
      classId: classRow.id,
      mindbodyClassId,
      title: classRow.title,
      startsAt: classRow.starts_at,
      visitors,
      cached: false,
    };

    await cacheSet(svc, cacheKey, payload, ROSTER_TTL_SEC);
    return jsonResponse(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
});
