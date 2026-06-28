import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';

const DAILY_QUOTA_LIMIT = parseInt(Deno.env.get('MB_DAILY_QUOTA') ?? '1000', 10);
const MAX_CONCURRENT_MB = parseInt(Deno.env.get('MB_MAX_CONCURRENT') ?? '4', 10);

let activeMbRequests = 0;
const mbWaitQueue: Array<() => void> = [];

export async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeMbRequests >= MAX_CONCURRENT_MB) {
    await new Promise<void>((resolve) => {
      mbWaitQueue.push(resolve);
    });
  }

  activeMbRequests += 1;
  try {
    return await fn();
  } finally {
    activeMbRequests -= 1;
    const next = mbWaitQueue.shift();
    if (next) next();
  }
}

export async function assertQuota(svc: SupabaseClient): Promise<void> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  const { data, error } = await svc.rpc('mb_increment_quota', { p_day: today });

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to update Mindbody quota.');
  }

  const count = typeof data === 'number' ? data : 0;
  if (count > DAILY_QUOTA_LIMIT) {
    throw new MbError('QUOTA_EXCEEDED', 'Mindbody daily API quota reached.');
  }
}

type Bucket = { count: number; resetAt: number };

const entryBuckets = new Map<string, Bucket>();

/** Per-user sliding window for entry-checkin (per Edge isolate). */
export function assertRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const existing = entryBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    entryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= max) {
    throw new MbError('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
  }

  existing.count += 1;
}
