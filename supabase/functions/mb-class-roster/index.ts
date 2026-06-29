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
  FirstName?: unknown;
  LastName?: unknown;
  SignedIn?: unknown;
  SignedInStatus?: unknown;
};

type MbClassVisits = {
  Class?: {
    Id?: unknown;
    Clients?: MbClient[];
  };
  Visits?: MbClient[];
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

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function clientIdOf(client: MbClient): string | null {
  return asString(client.ClientId) ?? asString(client.Id);
}

function clientName(client: MbClient): string {
  const first = asString(client.FirstName) ?? '';
  const last = asString(client.LastName) ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Member';
}

function isSignedIn(client: MbClient): boolean {
  if (typeof client.SignedIn === 'boolean') return client.SignedIn;
  const status = asString(client.SignedInStatus)?.toLowerCase();
  return status === 'signedin' || status === 'true';
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

    const cacheKey = `classvisits:${mindbodyClassId}`;
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
    const rawClients = page.Class?.Clients ?? page.Visits ?? [];

    const clientIds = rawClients
      .map((client) => clientIdOf(client))
      .filter((value): value is string => Boolean(value));

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
      const mindbodyClientId = clientIdOf(client) ?? '';
      const userId = mindbodyClientId ? (linkMap.get(mindbodyClientId) ?? null) : null;
      return {
        mindbodyClientId,
        name: clientName(client),
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
