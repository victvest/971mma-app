import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { mindbodyLocalDateTimeToIso } from '../_shared/gymTime.ts';
import { requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet, mbPaginate } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

const SCHEDULE_TTL_SEC = 2 * 60;

type ScheduleRequest = {
  startDate?: string;
  endDate?: string;
  force?: boolean;
};

type MbStaff = {
  Id?: unknown;
  Name?: unknown;
};

type MbProgram = {
  Id?: unknown;
  Name?: unknown;
};

type MbSessionType = {
  Id?: unknown;
  Name?: unknown;
};

type MbClassDescription = {
  Name?: unknown;
  Description?: unknown;
  Level?: unknown;
  Program?: MbProgram;
  SessionType?: MbSessionType;
};

type MbClass = {
  Id?: unknown;
  StartDateTime?: unknown;
  EndDateTime?: unknown;
  MaxCapacity?: unknown;
  TotalBooked?: unknown;
  IsAvailable?: unknown;
  IsWaitlistAvailable?: unknown;
  IsCanceled?: unknown;
  ClassDescription?: MbClassDescription;
  Staff?: MbStaff;
};

type ClassesResponse = {
  Classes?: MbClass[];
};

type ResolvedProgram = {
  id: string;
  discipline_id: string | null;
};

type CoachCacheItem = {
  id: string;
  name: string;
  mindbody_staff_id: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function durationMinutes(start: string, end: string): number {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return Math.max(1, minutes);
}

function disciplineOf(classDescription: MbClassDescription | undefined): string {
  return (
    asString(classDescription?.SessionType?.Name) ??
    asString(classDescription?.Program?.Name) ??
    'General'
  );
}

function normalizeMindbodyDateTime(value: string, boundary: 'start' | 'end'): string {
  const trimmed = value.trim();
  if (trimmed.includes('T')) return trimmed;
  return boundary === 'start' ? `${trimmed}T00:00:00` : `${trimmed}T23:59:59`;
}

function parseRange(body: ScheduleRequest): { startDate: string; endDate: string } {
  const rawStart = body.startDate?.trim();
  const rawEnd = body.endDate?.trim();
  if (!rawStart || !rawEnd) {
    throw new MbError('BAD_REQUEST', 'startDate and endDate are required.');
  }
  return {
    startDate: normalizeMindbodyDateTime(rawStart, 'start'),
    endDate: normalizeMindbodyDateTime(rawEnd, 'end'),
  };
}

function rangeBoundsISO(startDate: string, endDate: string): { fromISO: string; toISO: string } {
  const fromISO = new Date(`${startDate}+04:00`).toISOString();
  const toISO = new Date(`${endDate}+04:00`).toISOString();
  if (Number.isNaN(fromISO.valueOf()) || Number.isNaN(toISO.valueOf())) {
    throw new MbError('BAD_REQUEST', 'startDate and endDate must be valid gym-local dates.');
  }
  return { fromISO, toISO };
}

const TOMBSTONE_BATCH_SIZE = 100;

async function resolveProgram(
  svc: ReturnType<typeof serviceClient>,
  cache: Map<string, ResolvedProgram | null>,
  mbProgramId: string | null,
): Promise<ResolvedProgram | null> {
  if (!mbProgramId) return null;
  if (cache.has(mbProgramId)) return cache.get(mbProgramId) ?? null;

  const { data } = await svc
    .from('programs')
    .select('id, discipline_id')
    .eq('mindbody_program_id', mbProgramId)
    .maybeSingle<ResolvedProgram>();

  const value = data ?? null;
  cache.set(mbProgramId, value);
  return value;
}

function resolveCoachId(
  coaches: CoachCacheItem[],
  staffId: string | null,
  staffName: string | null,
): string | null {
  if (staffId) {
    const match = coaches.find((c) => c.mindbody_staff_id === staffId);
    if (match) return match.id;
  }

  if (staffName) {
    const normName = staffName.trim().toLowerCase();
    const match = coaches.find((c) => c.name.trim().toLowerCase() === normName);
    if (match) return match.id;
  }

  return null;
}

function mapClassRow(
  mbClass: MbClass,
  programId: string | null,
  disciplineId: string | null,
  coachId: string | null,
  syncedAt: string,
): Record<string, unknown> | null {
  const mindbodyClassId = asString(mbClass.Id);
  const rawStartsAt = asString(mbClass.StartDateTime);
  const rawEndsAt = asString(mbClass.EndDateTime);
  const title = asString(mbClass.ClassDescription?.Name);
  if (!mindbodyClassId || !rawStartsAt || !rawEndsAt || !title) return null;

  const startsAt = mindbodyLocalDateTimeToIso(rawStartsAt);
  const endsAt = mindbodyLocalDateTimeToIso(rawEndsAt);
  if (!startsAt || !endsAt) return null;

  return {
    mindbody_class_id: mindbodyClassId,
    title,
    discipline: disciplineOf(mbClass.ClassDescription),
    discipline_id: disciplineId,
    description: asString(mbClass.ClassDescription?.Description),
    coach_name: asString(mbClass.Staff?.Name) ?? 'Coach',
    coach_id: coachId,
    starts_at: startsAt,
    duration_minutes: durationMinutes(startsAt, endsAt),
    capacity: asNumber(mbClass.MaxCapacity, 0),
    level: asString(mbClass.ClassDescription?.Level) ?? 'All Levels',
    program_id: programId,
    staff_mindbody_id: asString(mbClass.Staff?.Id),
    booked_count: asNumber(mbClass.TotalBooked, 0),
    is_available: asBoolean(mbClass.IsAvailable, false),
    is_waitlist_available: asBoolean(mbClass.IsWaitlistAvailable, false),
    is_cancelled: asBoolean(mbClass.IsCanceled, false),
    last_synced_at: syncedAt,
  };
}

async function tombstoneMissingClasses(
  svc: ReturnType<typeof serviceClient>,
  startDate: string,
  endDate: string,
  fetchedIds: Set<string>,
  syncedAt: string,
): Promise<number> {
  const { fromISO, toISO } = rangeBoundsISO(startDate, endDate);

  const { data, error } = await svc
    .from('classes')
    .select('id, mindbody_class_id')
    .not('mindbody_class_id', 'is', null)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
    .eq('is_cancelled', false);

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to read stale class mirror rows: ${error.message}`);
  }

  const staleIds = (data ?? [])
    .filter((row) => {
      const mindbodyClassId = row.mindbody_class_id;
      return typeof mindbodyClassId === 'string' && !fetchedIds.has(mindbodyClassId);
    })
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string');

  if (staleIds.length === 0) return 0;

  let tombstoned = 0;
  for (let offset = 0; offset < staleIds.length; offset += TOMBSTONE_BATCH_SIZE) {
    const batch = staleIds.slice(offset, offset + TOMBSTONE_BATCH_SIZE);
    const { error: updateError } = await svc
      .from('classes')
      .update({ is_cancelled: true, is_available: false, last_synced_at: syncedAt })
      .in('id', batch);

    if (updateError) {
      throw new MbError('UPSTREAM_ERROR', `Unable to tombstone stale classes: ${updateError.message}`);
    }
    tombstoned += batch.length;
  }

  return tombstoned;
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
    await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as ScheduleRequest;
    const { startDate, endDate } = parseRange(body);
    const force = body.force === true;
    const svc = serviceClient();
    const cacheKey = `schedule:${startDate}:${endDate}`;

    if (!force) {
      const cached = await cacheGet<{ refreshed: boolean }>(svc, cacheKey);
      if (cached) {
        return jsonResponse({ refreshed: false, count: 0 });
      }
    }

    const [classes, coachesResult] = await Promise.all([
      mbPaginate<MbClass, ClassesResponse>(
        svc,
        '/class/classes',
        {
          'request.startDateTime': startDate,
          'request.endDateTime': endDate,
          'request.hideCanceledClasses': 'false',
        },
        (page) => page.Classes ?? [],
      ),
      svc.from('coaches').select('id, name, mindbody_staff_id').eq('active', true),
    ]);

    if (coachesResult.error) {
      throw new MbError('UPSTREAM_ERROR', `Unable to read coaches reference: ${coachesResult.error.message}`);
    }

    const coaches = (coachesResult.data ?? []) as CoachCacheItem[];
    const programCache = new Map<string, ResolvedProgram | null>();
    const syncedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    const fetchedIds = new Set<string>();

    for (const mbClass of classes) {
      const mbProgramId = asString(mbClass.ClassDescription?.Program?.Id);
      const program = await resolveProgram(svc, programCache, mbProgramId);
      const staffId = asString(mbClass.Staff?.Id);
      const staffName = asString(mbClass.Staff?.Name);
      const coachId = resolveCoachId(coaches, staffId, staffName);

      const row = mapClassRow(mbClass, program?.id ?? null, program?.discipline_id ?? null, coachId, syncedAt);
      if (row) {
        fetchedIds.add(String(row.mindbody_class_id));
        rows.push(row);
      }
    }

    if (rows.length > 0) {
      const { error: upsertError } = await svc
        .from('classes')
        .upsert(rows, { onConflict: 'mindbody_class_id' });
      if (upsertError) {
        throw new MbError('UPSTREAM_ERROR', `Unable to upsert classes mirror: ${upsertError.message}`);
      }
      await cacheSet(svc, cacheKey, { refreshed: true }, SCHEDULE_TTL_SEC);
    }

    const tombstoned = await tombstoneMissingClasses(svc, startDate, endDate, fetchedIds, syncedAt);

    return jsonResponse({
      refreshed: true,
      count: rows.length,
      mindbodyFetched: classes.length,
      tombstoned,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
