import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireInternalSecret } from '../_shared/internalAuth.ts';
import { cacheSet, mbFetch } from '../_shared/mindbody.ts';
import {
  refreshMembershipMirror,
  type MembershipSummary,
} from '../_shared/membershipMirror.ts';
import {
  finishSyncJob,
  listPendingSyncJobs,
  startSyncJob,
  type SyncJobRow,
} from '../_shared/syncJobs.ts';
import { serviceClient } from '../_shared/supabase.ts';

const MEMBERSHIP_CACHE_TTL_SEC = 10 * 60;
const DEFAULT_JOB_LIMIT = 25;

type WorkerRequest = {
  limit?: number;
};

type ArrivalResponse = {
  ArrivalAdded?: boolean;
  ClientService?: { Id?: unknown };
  Visit?: { Id?: unknown };
};

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function workerLimit(raw: unknown): number {
  const value = asNumber(raw, DEFAULT_JOB_LIMIT);
  return Math.min(Math.max(value, 1), 100);
}

async function processArrivalJob(
  svc: ReturnType<typeof serviceClient>,
  job: SyncJobRow,
): Promise<void> {
  const checkInId = asString(job.payload.checkInId);
  const clientId = asString(job.payload.clientId);
  const locationId = asNumber(job.payload.locationId, parseInt(Deno.env.get('MINDBODY_LOCATION_ID') ?? '1', 10));

  if (!checkInId || !clientId) {
    throw new MbError('BAD_REQUEST', 'Arrival job payload is incomplete.');
  }

  const { data: checkIn, error: checkInError } = await svc
    .from('check_ins')
    .select('id, mindbody_visit_id')
    .eq('id', checkInId)
    .maybeSingle<{ id: string; mindbody_visit_id: string | null }>();

  if (checkInError || !checkIn) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to load gate check-in.');
  }

  if (checkIn.mindbody_visit_id) {
    return;
  }

  const arrival = await mbFetch<ArrivalResponse>(svc, '/client/addarrival', {
    method: 'POST',
    body: JSON.stringify({
      ClientId: clientId,
      LocationId: locationId,
    }),
  });

  const visitId = arrival.Visit?.Id ?? arrival.ClientService?.Id;
  if (visitId === undefined || visitId === null) {
    return;
  }

  const { error: updateError } = await svc
    .from('check_ins')
    .update({ mindbody_visit_id: String(visitId) })
    .eq('id', checkInId);

  if (updateError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to persist Mindbody arrival id.');
  }
}

async function processMembershipRefreshJob(
  svc: ReturnType<typeof serviceClient>,
  job: SyncJobRow,
): Promise<void> {
  const userId = asString(job.payload.targetUserId);
  if (!userId) {
    throw new MbError('BAD_REQUEST', 'Membership refresh payload is incomplete.');
  }

  const result = await refreshMembershipMirror(svc, userId);
  await cacheSet<MembershipSummary>(svc, `membership:${userId}`, result.summary, MEMBERSHIP_CACHE_TTL_SEC);
}

async function processJob(
  svc: ReturnType<typeof serviceClient>,
  job: SyncJobRow,
): Promise<void> {
  switch (job.job_type) {
    case 'mindbody_arrival':
      await processArrivalJob(svc, job);
      return;
    case 'mindbody_membership_refresh':
      await processMembershipRefreshJob(svc, job);
      return;
    default:
      throw new MbError('BAD_REQUEST', `Unsupported sync job type: ${job.job_type}`);
  }
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
    requireInternalSecret(req);
    const svc = serviceClient();
    const body = (await req.json().catch(() => ({}))) as WorkerRequest;
    const limit = workerLimit(body.limit);

    const pendingJobs = await listPendingSyncJobs(
      svc,
      ['mindbody_arrival', 'mindbody_membership_refresh'],
      limit,
    );

    let processed = 0;
    let completed = 0;
    let failed = 0;

    for (const pendingJob of pendingJobs) {
      const started = await startSyncJob(svc, pendingJob.id);
      if (!started) continue;

      processed += 1;

      try {
        await processJob(svc, started.job);
        await finishSyncJob(svc, started.job.id, started.runId, 'completed');
        completed += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unexpected sync job failure.';
        await finishSyncJob(svc, started.job.id, started.runId, 'failed', {
          errorMessage,
        });
        failed += 1;
      }
    }

    return jsonResponse({
      ok: true,
      queued: pendingJobs.length,
      processed,
      completed,
      failed,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
