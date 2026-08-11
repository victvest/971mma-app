import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';

export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type SyncJobRow = {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
};

type EnqueueOptions = {
  dedupeField?: string;
};

export async function enqueueSyncJob(
  svc: SupabaseClient,
  jobType: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<{ id: string; created: boolean }> {
  const now = new Date().toISOString();
  const { data, error } = await svc
    .from('sync_jobs')
    .insert({
      job_type: jobType,
      status: 'pending',
      payload,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (!error && data) {
    return { id: data.id, created: true };
  }

  if (error?.code !== '23505' || !options.dedupeField) {
    throw new MbError('UPSTREAM_ERROR', `Unable to enqueue ${jobType} job.`);
  }

  const dedupeValue = payload[options.dedupeField];
  if (typeof dedupeValue !== 'string' || !dedupeValue) {
    throw new MbError('UPSTREAM_ERROR', `Unable to resolve ${jobType} job dedupe.`);
  }

  const { data: existing, error: existingError } = await svc
    .from('sync_jobs')
    .select('id')
    .eq('job_type', jobType)
    .in('status', ['pending', 'running'])
    .contains('payload', { [options.dedupeField]: dedupeValue })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError || !existing) {
    throw new MbError('UPSTREAM_ERROR', `Unable to read ${jobType} job queue.`);
  }

  return { id: existing.id, created: false };
}

export async function listPendingSyncJobs(
  svc: SupabaseClient,
  jobTypes: string[],
  limit: number,
): Promise<SyncJobRow[]> {
  const { data, error } = await svc
    .from('sync_jobs')
    .select('id, job_type, payload')
    .in('job_type', jobTypes)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read sync job queue.');
  }

  return (data ?? []) as SyncJobRow[];
}

export async function startSyncJob(
  svc: SupabaseClient,
  jobId: string,
): Promise<{ job: SyncJobRow; runId: string | null } | null> {
  const now = new Date().toISOString();
  const { data: job, error: jobError } = await svc
    .from('sync_jobs')
    .update({
      status: 'running',
      error_message: null,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id, job_type, payload')
    .maybeSingle<SyncJobRow>();

  if (jobError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to start sync job.');
  }

  if (!job) return null;

  const { data: run, error: runError } = await svc
    .from('sync_job_runs')
    .insert({
      job_id: jobId,
      status: 'running',
      started_at: now,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (runError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to start sync job run.');
  }

  return {
    job,
    runId: run?.id ?? null,
  };
}

export async function finishSyncJob(
  svc: SupabaseClient,
  jobId: string,
  runId: string | null,
  status: Exclude<SyncJobStatus, 'pending'>,
  options: { errorMessage?: string | null } = {},
): Promise<void> {
  const finishedAt = new Date().toISOString();

  const { error: jobError } = await svc
    .from('sync_jobs')
    .update({
      status,
      error_message: options.errorMessage ?? null,
      updated_at: finishedAt,
    })
    .eq('id', jobId);

  if (jobError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to finish sync job.');
  }

  if (!runId) return;

  const { error: runError } = await svc
    .from('sync_job_runs')
    .update({
      status,
      error_message: options.errorMessage ?? null,
      finished_at: finishedAt,
    })
    .eq('id', runId);

  if (runError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to finish sync job run.');
  }
}
