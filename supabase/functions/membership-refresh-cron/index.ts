import { enqueueMembershipRefreshJob } from '../_shared/accessControl.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { toErrorResponse } from '../_shared/errors.ts';
import { requireInternalSecret } from '../_shared/internalAuth.ts';
import { serviceClient } from '../_shared/supabase.ts';

const DEFAULT_STALE_HOURS = 36;
const DEFAULT_LIMIT = 200;

type CronRequest = {
  limit?: number;
  staleHours?: number;
};

type ProfileRow = {
  id: string;
  role: string | null;
  membership_status: string | null;
  membership_last_synced_at: string | null;
};

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function staleThresholdIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
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
    const body = (await req.json().catch(() => ({}))) as CronRequest;
    const limit = Math.min(Math.max(asNumber(body.limit, DEFAULT_LIMIT), 1), 500);
    const staleHours = Math.min(Math.max(asNumber(body.staleHours, DEFAULT_STALE_HOURS), 1), 168);
    const thresholdIso = staleThresholdIso(staleHours);

    const { data: links, error: linkError } = await svc
      .from('mindbody_links')
      .select('user_id')
      .limit(2000);

    if (linkError) {
      throw linkError;
    }

    const userIds = [...new Set((links ?? []).map((row) => row.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      return jsonResponse({ ok: true, candidates: 0, enqueued: 0, staleHours });
    }

    const { data: profiles, error: profileError } = await svc
      .from('profiles')
      .select('id, role, membership_status, membership_last_synced_at')
      .in('id', userIds);

    if (profileError) {
      throw profileError;
    }

    const candidates = ((profiles ?? []) as ProfileRow[])
      .filter((profile) => profile.role === 'member' || profile.role === 'guest')
      .filter((profile) => {
        if (!profile.membership_last_synced_at) return true;
        return profile.membership_last_synced_at < thresholdIso;
      })
      .sort((left, right) => {
        const leftKey = left.membership_last_synced_at ?? '';
        const rightKey = right.membership_last_synced_at ?? '';
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, limit);

    let enqueued = 0;
    let created = 0;
    for (const candidate of candidates) {
      const result = await enqueueMembershipRefreshJob(svc, candidate.id, 'scheduled_membership_refresh');
      enqueued += 1;
      if (result.created) created += 1;
    }

    return jsonResponse({
      ok: true,
      candidates: candidates.length,
      enqueued,
      created,
      staleHours,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
