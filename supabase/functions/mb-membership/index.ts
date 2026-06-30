import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet, mbFetch } from '../_shared/mindbody.ts';
import { syncMemberDisciplinesFromMembershipMirror } from '../_shared/membershipDisciplines.ts';
import { serviceClient } from '../_shared/supabase.ts';

const MEMBERSHIP_CACHE_TTL_SEC = 10 * 60;

type MembershipRequest = {
  force?: boolean;
  targetUserId?: string;
};

type MbActiveMembership = {
  Id?: unknown;
  Name?: unknown;
  MembershipId?: unknown;
  ExpirationDate?: unknown;
  ActiveDate?: unknown;
  Current?: unknown;
  Suspended?: unknown;
};

type MbContract = {
  Id?: unknown;
  Name?: unknown;
  ContractName?: unknown;
  StartDate?: unknown;
  EndDate?: unknown;
  AutoRenewing?: unknown;
  AutopayStatus?: unknown;
  TerminationDate?: unknown;
};

type ActiveMembershipsResponse = {
  ActiveClientMemberships?: MbActiveMembership[];
  ClientMemberships?: MbActiveMembership[];
};

type ClientContractsResponse = {
  Contracts?: MbContract[];
};

type MirrorRow = {
  user_id: string;
  record_kind: 'membership' | 'contract';
  mindbody_record_id: string;
  mindbody_contract_id: string | null;
  mindbody_membership_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  source: 'mindbody';
  raw: Record<string, unknown>;
  last_synced_at: string;
};

type MembershipSummary = {
  planName: string | null;
  status: 'active' | 'paused' | 'expired' | 'none';
  expiresAt: string | null;
  autoRenew: boolean;
  source: 'mindbody' | null;
  lastSyncedAt: string | null;
  count: number;
};

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asIso(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isPast(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function normalizeMembershipStatus(
  suspended: boolean,
  current: boolean,
  endDate: string | null,
  terminationDate: string | null,
): string {
  if (terminationDate || isPast(endDate)) return 'expired';
  if (suspended || !current) return 'paused';
  return 'active';
}

function mapActiveMembership(userId: string, item: MbActiveMembership, syncedAt: string): MirrorRow | null {
  const recordId = asString(item.Id);
  const name = asString(item.Name);
  if (!recordId || !name) return null;

  const endDate = asIso(item.ExpirationDate);
  const startDate = asIso(item.ActiveDate);
  const current = asBoolean(item.Current, true);
  const suspended = asBoolean(item.Suspended, false);

  return {
    user_id: userId,
    record_kind: 'membership',
    mindbody_record_id: recordId,
    mindbody_contract_id: null,
    mindbody_membership_id: asString(item.MembershipId),
    name,
    status: normalizeMembershipStatus(suspended, current, endDate, null),
    start_date: startDate,
    end_date: endDate,
    auto_renew: false,
    source: 'mindbody',
    raw: item as Record<string, unknown>,
    last_synced_at: syncedAt,
  };
}

function mapContract(userId: string, item: MbContract, syncedAt: string): MirrorRow | null {
  const recordId = asString(item.Id);
  const name = asString(item.ContractName) ?? asString(item.Name);
  if (!recordId || !name) return null;

  const startDate = asIso(item.StartDate);
  const endDate = asIso(item.EndDate);
  const terminationDate = asIso(item.TerminationDate);
  const autopay = asString(item.AutopayStatus)?.toLowerCase() ?? '';
  const autoRenew = asBoolean(item.AutoRenewing, false);
  const paused = autopay.includes('inactive') || autopay.includes('suspend');
  const status = terminationDate || isPast(endDate)
    ? 'expired'
    : paused
      ? 'paused'
      : 'active';

  return {
    user_id: userId,
    record_kind: 'contract',
    mindbody_record_id: recordId,
    mindbody_contract_id: recordId,
    mindbody_membership_id: null,
    name,
    status,
    start_date: startDate,
    end_date: endDate,
    auto_renew: autoRenew,
    source: 'mindbody',
    raw: item as Record<string, unknown>,
    last_synced_at: syncedAt,
  };
}

function pickSummary(rows: MirrorRow[], syncedAt: string): MembershipSummary {
  if (rows.length === 0) {
    return {
      planName: null,
      status: 'none',
      expiresAt: null,
      autoRenew: false,
      source: 'mindbody',
      lastSyncedAt: syncedAt,
      count: 0,
    };
  }

  const ranked = [...rows].sort((left, right) => {
    const score = (row: MirrorRow) => {
      if (row.status === 'active') return 3;
      if (row.status === 'paused') return 2;
      return 1;
    };
    const leftScore = score(left);
    const rightScore = score(right);
    if (leftScore !== rightScore) return rightScore - leftScore;
    if (left.record_kind === 'membership' && right.record_kind !== 'membership') return -1;
    if (right.record_kind === 'membership' && left.record_kind !== 'membership') return 1;
    return (right.end_date ?? '').localeCompare(left.end_date ?? '');
  });

  const primary = ranked[0];
  const profileStatus =
    primary.status === 'active' || primary.status === 'paused' || primary.status === 'expired'
      ? primary.status
      : 'none';

  const activeEndDates = rows
    .filter((row) => (row.status === 'active' || row.status === 'paused') && row.end_date)
    .map((row) => row.end_date);

  let expiresAt = primary.end_date;
  for (const endDate of activeEndDates) {
    if (!endDate) continue;
    if (!expiresAt || new Date(endDate).getTime() > new Date(expiresAt).getTime()) {
      expiresAt = endDate;
    }
  }

  return {
    planName: primary.name,
    status: profileStatus,
    expiresAt,
    autoRenew: primary.auto_renew,
    source: 'mindbody',
    lastSyncedAt: syncedAt,
    count: rows.length,
  };
}

async function readSummaryFromMirror(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<MembershipSummary | null> {
  const [{ data: profile }, { count, error }] = await Promise.all([
    svc
      .from('profiles')
      .select('membership_name, membership_status, membership_expires_at, membership_source, membership_last_synced_at')
      .eq('id', userId)
      .maybeSingle<{
        membership_name: string | null;
        membership_status: string | null;
        membership_expires_at: string | null;
        membership_source: string | null;
        membership_last_synced_at: string | null;
      }>(),
    svc
      .from('member_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (error) return null;
  if (!profile?.membership_last_synced_at) return null;

  const rowCount = count ?? 0;
  const status =
    rowCount === 0
      ? 'none'
      : profile.membership_status === 'active' ||
          profile.membership_status === 'paused' ||
          profile.membership_status === 'expired'
        ? profile.membership_status
        : 'none';

  return {
    planName: profile.membership_name,
    status,
    expiresAt: profile.membership_expires_at,
    autoRenew: false,
    source: profile.membership_source === 'mindbody' ? 'mindbody' : null,
    lastSyncedAt: profile.membership_last_synced_at,
    count: rowCount,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

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

    if (!force) {
      const cached = await cacheGet<MembershipSummary>(svc, cacheKey);
      if (cached) {
        return jsonResponse({ refreshed: false, summary: cached });
      }

      const mirrorSummary = await readSummaryFromMirror(svc, userId);
      if (mirrorSummary) {
        await cacheSet(svc, cacheKey, mirrorSummary, MEMBERSHIP_CACHE_TTL_SEC);
        return jsonResponse({ refreshed: false, summary: mirrorSummary });
      }
    }

    const { data: link, error: linkError } = await svc
      .from('mindbody_links')
      .select('mindbody_client_id')
      .eq('user_id', userId)
      .maybeSingle<{ mindbody_client_id: string }>();

    if (linkError || !link) {
      throw new MbError('NOT_LINKED', 'Mindbody account not linked.');
    }

    const clientId = link.mindbody_client_id;
    const query = new URLSearchParams({ 'request.clientId': clientId });

    const [membershipsResponse, contractsResponse] = await Promise.all([
      mbFetch<ActiveMembershipsResponse>(
        svc,
        `/client/activeclientmemberships?${query.toString()}`,
      ),
      mbFetch<ClientContractsResponse>(svc, `/client/clientcontracts?${query.toString()}`),
    ]);

    const syncedAt = new Date().toISOString();
    const rows: MirrorRow[] = [];

    const activeMemberships = membershipsResponse.ClientMemberships ?? membershipsResponse.ActiveClientMemberships ?? [];
    for (const item of activeMemberships) {
      const mapped = mapActiveMembership(userId, item, syncedAt);
      if (mapped) rows.push(mapped);
    }

    for (const item of contractsResponse.Contracts ?? []) {
      const mapped = mapContract(userId, item, syncedAt);
      if (mapped) rows.push(mapped);
    }

    const { error: deleteError } = await svc.from('member_memberships').delete().eq('user_id', userId);
    if (deleteError) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to reset membership mirror rows.');
    }

    if (rows.length > 0) {
      const { error: insertError } = await svc.from('member_memberships').insert(rows);
      if (insertError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to store membership mirror rows.');
      }
    }

    const summary = pickSummary(rows, syncedAt);
    const profileStatus =
      summary.status === 'active' || summary.status === 'paused' || summary.status === 'expired'
        ? summary.status
        : 'expired';

    const { error: profileError } = await svc
      .from('profiles')
      .update({
        membership_name: summary.planName,
        membership_status: profileStatus,
        membership_expires_at: summary.expiresAt,
        membership_source: summary.source,
        membership_last_synced_at: syncedAt,
      })
      .eq('id', userId);

    if (profileError) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to update profile membership summary.');
    }

    let disciplinesSynced = 0;
    try {
      disciplinesSynced = await syncMemberDisciplinesFromMembershipMirror(svc, userId, rows);
    } catch {
      // Membership mirror is authoritative; discipline derivation is best-effort.
    }

    await cacheSet(svc, cacheKey, summary, MEMBERSHIP_CACHE_TTL_SEC);

    return jsonResponse({ refreshed: true, summary, disciplinesSynced });
  } catch (error) {
    return toErrorResponse(error);
  }
});
