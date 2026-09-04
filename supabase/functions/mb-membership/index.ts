import { jsonResponse, withCors } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet } from '../_shared/mindbody.ts';
import {
  readMembershipSummaryFromMirror,
  refreshMembershipMirror,
  type MembershipSummary,
} from '../_shared/membershipMirror.ts';
import { serviceClient } from '../_shared/supabase.ts';

/** Soft-cache TTL — must stay aligned with MEMBERSHIP_FRESH_MS below. */
const MEMBERSHIP_CACHE_TTL_SEC = 5 * 60;
/** Re-hit Mindbody when mirror/cache lastSyncedAt is older than this (non-force). */
const MEMBERSHIP_FRESH_MS = MEMBERSHIP_CACHE_TTL_SEC * 1000;

type MembershipRequest = {
  force?: boolean;
  targetUserId?: string;
};

function isMembershipSummaryFresh(summary: MembershipSummary | null | undefined): boolean {
  if (!summary?.lastSyncedAt) return false;
  const syncedAt = new Date(summary.lastSyncedAt).getTime();
  if (Number.isNaN(syncedAt)) return false;
  return Date.now() - syncedAt < MEMBERSHIP_FRESH_MS;
}

Deno.serve((req) => withCors(req, async () => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const { userId: callerUserId } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as MembershipRequest;
    const force = body.force === true;
    const svc = serviceClient();
    const userId = await resolveTargetUserId(svc, callerUserId, body.targetUserId);
    const cacheKey = `membership:${userId}`;

    const { data: unlimited } = await svc
      .from('unlimited_access_members')
      .select('id, reason, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle<{ id: string; reason: string | null; is_active: boolean }>();

    if (unlimited?.is_active) {
      const syncedAt = new Date().toISOString();
      const expiresAt = '2099-12-31T23:59:59.000Z';
      const summary: MembershipSummary = {
        planName: unlimited.reason || 'VIP Unlimited Access',
        status: 'active',
        expiresAt,
        autoRenew: true,
        source: 'mindbody',
        lastSyncedAt: syncedAt,
        count: 1,
      };
      await Promise.all([
        cacheSet(svc, cacheKey, summary, MEMBERSHIP_CACHE_TTL_SEC),
        svc
          .from('profiles')
          .update({
            membership_status: 'active',
            membership_name: summary.planName,
            membership_source: 'unlimited',
            membership_expires_at: expiresAt,
            membership_last_synced_at: syncedAt,
          })
          .eq('id', userId),
        svc
          .from('member_memberships')
          .update({
            end_date: expiresAt,
            last_synced_at: syncedAt,
          })
          .eq('user_id', userId)
          .eq('mindbody_record_id', `vip-${userId}`),
      ]);
      return jsonResponse({
        refreshed: true,
        summary,
        disciplinesSynced: 0,
      });
    }

    if (!force) {
      const cached = await cacheGet<MembershipSummary>(svc, cacheKey);
      if (cached && isMembershipSummaryFresh(cached)) {
        return jsonResponse({ refreshed: false, summary: cached });
      }

      const mirrorSummary = await readMembershipSummaryFromMirror(svc, userId);
      if (mirrorSummary && isMembershipSummaryFresh(mirrorSummary)) {
        await cacheSet(svc, cacheKey, mirrorSummary, MEMBERSHIP_CACHE_TTL_SEC);
        return jsonResponse({ refreshed: false, summary: mirrorSummary });
      }
    }

    const result = await refreshMembershipMirror(svc, userId);
    await cacheSet(svc, cacheKey, result.summary, MEMBERSHIP_CACHE_TTL_SEC);

    return jsonResponse({
      refreshed: true,
      summary: result.summary,
      disciplinesSynced: result.disciplinesSynced,
    });
  } catch (error) {
    if (error instanceof MbError && error.code === 'NOT_LINKED') {
      return toErrorResponse(error);
    }
    return toErrorResponse(error);
  }
}));
