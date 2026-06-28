import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { mindbodyLocalDateTimeToIso } from '../_shared/gymTime.ts';
import { requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet, mbPaginate } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type VisitsRequest = {
  targetUserId?: string;
};

const VISITS_CACHE_TTL_SEC = 5 * 60;
const HISTORY_DAYS = 365;
const VISIT_METHOD = 'mindbody_visit';

type MbVisit = {
  Id?: unknown;
  StartDateTime?: unknown;
  ClassId?: unknown;
  Class?: { Id?: unknown };
  SignedIn?: unknown;
  Missed?: unknown;
  LateCancelled?: unknown;
};

type VisitsResponse = {
  Visits?: MbVisit[];
  PaginationResponse?: { TotalResults?: unknown };
};

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number') return String(value);
  return null;
}

async function resolveClassId(
  svc: ReturnType<typeof serviceClient>,
  cache: Map<string, string | null>,
  mindbodyClassId: string | null,
): Promise<string | null> {
  if (!mindbodyClassId) return null;
  if (cache.has(mindbodyClassId)) return cache.get(mindbodyClassId) ?? null;

  const { data } = await svc
    .from('classes')
    .select('id')
    .eq('mindbody_class_id', mindbodyClassId)
    .maybeSingle<{ id: string }>();

  const value = data?.id ?? null;
  cache.set(mindbodyClassId, value);
  return value;
}

async function finishSyncRun(
  svc: ReturnType<typeof serviceClient>,
  ids: { jobId: string | null; runId: string | null },
  status: 'completed' | 'failed',
  details: { errorMessage?: string; result?: Record<string, unknown> } = {},
): Promise<void> {
  const finishedAt = new Date().toISOString();

  if (ids.jobId) {
    void details.result;
    await svc
      .from('sync_jobs')
      .update({
        status,
        error_message: details.errorMessage ?? null,
        updated_at: finishedAt,
      })
      .eq('id', ids.jobId);
  }

  if (ids.runId) {
    await svc
      .from('sync_job_runs')
      .update({
        status,
        error_message: details.errorMessage ?? null,
        finished_at: finishedAt,
      })
      .eq('id', ids.runId);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  const svc = serviceClient();
  let jobId: string | null = null;
  let runId: string | null = null;

  try {
    const { userId: callerUserId } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as VisitsRequest;
    const userId = await resolveTargetUserId(svc, callerUserId, body.targetUserId);

    // 1. Create Sync Job and Run records
    const { data: job } = await svc
      .from('sync_jobs')
      .insert({
        job_type: 'mindbody_visits',
        status: 'running',
        payload: { targetUserId: userId },
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (job) {
      jobId = job.id;
      const { data: run } = await svc
        .from('sync_job_runs')
        .insert({
          job_id: jobId,
          status: 'running',
        })
        .select('id')
        .maybeSingle<{ id: string }>();
      runId = run?.id ?? null;
    }

    const cacheKey = `visits:${userId}`;
    const cached = await cacheGet<{ count: number }>(svc, cacheKey);
    if (cached) {
      await finishSyncRun(
        svc,
        { jobId, runId },
        'completed',
        { result: { cached: true, count: cached.count } },
      );
      return jsonResponse({ refreshed: false, count: cached.count });
    }

    const { data: link, error: linkError } = await svc
      .from('mindbody_links')
      .select('mindbody_client_id')
      .eq('user_id', userId)
      .maybeSingle<{ mindbody_client_id: string }>();

    if (linkError || !link) throw new MbError('NOT_LINKED', 'Mindbody account not linked.');

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [visits, existingCheckIns] = await Promise.all([
      mbPaginate<MbVisit, VisitsResponse>(
        svc,
        '/client/clientvisits',
        {
          'request.clientId': link.mindbody_client_id,
          'request.startDate': startDate,
          'request.endDate': endDate,
        },
        (page) => page.Visits ?? [],
      ),
      svc
        .from('check_ins')
        .select('id, mindbody_visit_id, class_id')
        .eq('user_id', userId),
    ]);

    if (existingCheckIns.error) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to fetch existing check-in records.');
    }

    const visitIdToRowId = new Map<string, string>();
    const classIdToRowId = new Map<string, string>();

    for (const row of existingCheckIns.data ?? []) {
      if (row.mindbody_visit_id) {
        visitIdToRowId.set(row.mindbody_visit_id, row.id);
      } else if (row.class_id) {
        classIdToRowId.set(row.class_id, row.id);
      }
    }

    const now = new Date().toISOString();
    const classCache = new Map<string, string | null>();
    const rowsToInsert: any[] = [];
    const rowsToUpdate: any[] = [];

    for (const visit of visits) {
      const visitId = asString(visit.Id);
      if (!visitId) continue;
      const mindbodyClassId = asString(visit.ClassId) ?? asString(visit.Class?.Id);
      const classId = await resolveClassId(svc, classCache, mindbodyClassId);
      const signedIn = typeof visit.SignedIn === 'boolean' ? visit.SignedIn : true;
      const missed = typeof visit.Missed === 'boolean' ? visit.Missed : false;
      const lateCancelled = typeof visit.LateCancelled === 'boolean' ? visit.LateCancelled : false;
      const checkedInAt = mindbodyLocalDateTimeToIso(asString(visit.StartDateTime) ?? '') ?? now;

      let targetRowId: string | null = null;

      if (visitIdToRowId.has(visitId)) {
        targetRowId = visitIdToRowId.get(visitId)!;
      } else if (classId && classIdToRowId.has(classId)) {
        targetRowId = classIdToRowId.get(classId)!;
      }

      const rowData = {
        user_id: userId,
        mindbody_visit_id: visitId,
        class_id: classId,
        method: VISIT_METHOD,
        source: 'mindbody',
        checked_in_at: checkedInAt,
        signed_in: signedIn,
        missed: missed,
        late_cancelled: lateCancelled,
        raw_payload: visit,
      };

      if (targetRowId) {
        rowsToUpdate.push({
          id: targetRowId,
          ...rowData,
        });
      } else {
        rowsToInsert.push(rowData);
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await svc.from('check_ins').insert(rowsToInsert);
      if (insertError) throw new MbError('UPSTREAM_ERROR', 'Unable to insert visit history.');
    }

    if (rowsToUpdate.length > 0) {
      const { error: updateError } = await svc.from('check_ins').upsert(rowsToUpdate);
      if (updateError) throw new MbError('UPSTREAM_ERROR', 'Unable to update visit history.');
    }

    const totalCount = rowsToInsert.length + rowsToUpdate.length;
    await cacheSet(svc, cacheKey, { count: totalCount }, VISITS_CACHE_TTL_SEC);

    await finishSyncRun(
      svc,
      { jobId, runId },
      'completed',
      {
        result: {
          cached: false,
          inserted: rowsToInsert.length,
          updated: rowsToUpdate.length,
          total: totalCount,
        },
      },
    );

    return jsonResponse({ refreshed: true, count: totalCount });
  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    await finishSyncRun(
      svc,
      { jobId, runId },
      'failed',
      { errorMessage: errObj.message },
    );
    return toErrorResponse(error);
  }
});
