import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';
import { GYM_UTC_OFFSET } from './gymTime.ts';
import { verifyMemberQrToken } from './memberQrToken.ts';
import { mbFetch } from './mindbody.ts';
import { fetchLiveMembershipEligibility } from './membershipMirror.ts';
import { enqueueSyncJob } from './syncJobs.ts';

const DEFAULT_DUPLICATE_WINDOW_SECONDS = 30;

export type AccessDecisionReasonCode =
  | 'granted'
  | 'duplicate_recent_grant'
  | 'already_checked_in_today'
  | 'token_already_used'
  | 'unsupported_type'
  | 'device_unknown'
  | 'device_disabled'
  | 'member_not_found'
  | 'not_linked'
  | 'membership_none'
  | 'membership_paused'
  | 'membership_expired'
  | 'mindbody_unavailable';

export type GateAttemptType = 'QR' | 'CARD' | 'PIN' | 'UNKNOWN';

export type GateAccessDecision = {
  granted: boolean;
  message: string;
  reasonCode: AccessDecisionReasonCode;
  type: GateAttemptType;
  requestType: string;
  memberUserId: string | null;
  mindbodyClientId: string | null;
  membershipStatus: string | null;
  membershipLastSyncedAt: string | null;
  tokenJti: string | null;
  tokenExpiresAt: string | null;
  checkInId: string | null;
  arrivalJobId: string | null;
  shouldEnqueueMembershipRefresh: boolean;
};

export type GateMemberProfile = {
  memberUserId: string;
  memberId: string;
  mindbodyClientId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  imageBase64: string | null;
};

type MemberAccessContext = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  membershipStatus: string | null;
  membershipExpiresAt: string | null;
  membershipLastSyncedAt: string | null;
  membershipSource: string | null;
  mindbodyClientId: string | null;
  isUnlimitedAccess?: boolean;
  hasActiveMirrorRow?: boolean;
};

type EvaluateAccessInput = {
  svc: SupabaseClient;
  deviceId: string;
  token: string;
  rawType: string;
};

type EvaluateAccessByMemberIdInput = {
  svc: SupabaseClient;
  deviceId: string;
  memberId: string;
};

type GateAccessAttemptLog = {
  memberUserId?: string | null;
  mindbodyClientId?: string | null;
  deviceId: string;
  type: GateAttemptType;
  requestType?: string | null;
  granted: boolean;
  message: string;
  reasonCode: string;
  membershipStatus?: string | null;
  membershipLastSyncedAt?: string | null;
  tokenJti?: string | null;
  tokenExpiresAt?: string | null;
  checkInId?: string | null;
  arrivalJobId?: string | null;
  rawRequest: Record<string, unknown>;
  rawResponse: Record<string, unknown>;
  requestedAt?: string;
  respondedAt?: string;
};

type ArrivalResponse = {
  ArrivalAdded?: boolean;
  ClientService?: { Id?: unknown };
  Visit?: { Id?: unknown };
};

type MindbodyAccessErrorResult = {
  granted: boolean;
  reasonCode: AccessDecisionReasonCode;
  membershipStatus: string | null;
  message: string;
};

const MAX_LOCAL_MIRROR_STALE_MS = 48 * 60 * 60 * 1000; // 48 hours
const LIVE_FALLBACK_TIMEOUT_MS = 2200; // 2.2 seconds (under Gantner's 3.0s hardware limit)

export function isLocallyEligibleMembership(member: MemberAccessContext): boolean {
  if (member.isUnlimitedAccess || member.membershipSource === 'unlimited') {
    return true;
  }

  if (member.membershipStatus !== 'active') {
    return false;
  }

  if (member.membershipExpiresAt) {
    const expiresEpoch = new Date(member.membershipExpiresAt).getTime();
    if (Number.isFinite(expiresEpoch) && expiresEpoch < Date.now()) {
      return false;
    }
  }

  if (!member.membershipLastSyncedAt) {
    return false;
  }
  const lastSyncedEpoch = new Date(member.membershipLastSyncedAt).getTime();
  if (!Number.isFinite(lastSyncedEpoch) || Date.now() - lastSyncedEpoch > MAX_LOCAL_MIRROR_STALE_MS) {
    return false;
  }

  if (!member.hasActiveMirrorRow && member.membershipSource !== 'mindbody') {
    return false;
  }

  return true;
}

function runBackground(promise: Promise<unknown>): void {
  // @ts-ignore EdgeRuntime is provided by Deno Deploy / Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise);
  } else {
    promise.catch((err: unknown) => console.warn('[accessControl] background task failed', err));
  }
}

async function writeMindbodyArrivalAndRecord(
  svc: SupabaseClient,
  clientId: string,
  checkInId: string,
): Promise<void> {
  try {
    const visitId = await writeMindbodyArrival(svc, clientId);
    if (visitId) {
      await svc
        .from('check_ins')
        .update({ mindbody_visit_id: visitId })
        .eq('id', checkInId);
    }
  } catch (error) {
    console.warn('[accessControl] async arrival write failed, queuing sync job', error);
    await enqueueSyncJob(
      svc,
      'mindbody_arrival',
      {
        checkInId,
        clientId,
        locationId: parseInt(Deno.env.get('MINDBODY_LOCATION_ID') ?? '1', 10),
      },
      { dedupeField: 'checkInId' },
    ).catch((jobErr) => {
      console.warn('[accessControl] failed to enqueue arrival job', jobErr);
    });
  }
}

function envNumber(key: string, fallback: number): number {
  const raw = Deno.env.get(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function duplicateWindowMs(): number {
  return envNumber('SALTO_DUPLICATE_WINDOW_SECONDS', DEFAULT_DUPLICATE_WINDOW_SECONDS) * 1000;
}

export function normalizeGateAttemptType(raw: string | null | undefined): GateAttemptType {
  const value = raw?.trim().toUpperCase();
  if (value === 'QR' || value === 'CARD' || value === 'PIN') return value;
  return 'UNKNOWN';
}

function gateDenied(message: string): { Granted: false; Message: string } {
  return { Granted: false, Message: message };
}

function gateGranted(message: string): { Granted: true; Message: string } {
  return { Granted: true, Message: message };
}

function gymTodayBounds(): { start: string; end: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  return {
    start: new Date(`${today}T00:00:00${GYM_UTC_OFFSET}`).toISOString(),
    end: new Date(`${today}T23:59:59.999${GYM_UTC_OFFSET}`).toISOString(),
  };
}

function parseAllowedDeviceIds(): Set<string> {
  const raw =
    Deno.env.get('SALTO_ALLOWED_DEVICE_IDS') ?? Deno.env.get('SALTO_DEVICE_ALLOWLIST') ?? '';

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  const normalized = fullName?.trim() ?? '';
  if (!normalized) return { firstName: '', lastName: '' };

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function imageBase64FromAvatarUrl(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed.toLowerCase().startsWith('data:image/')) return null;

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return null;

  const payload = trimmed.slice(commaIndex + 1).trim();
  return payload || null;
}

function isAlreadyCheckedInMessage(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes('already checked in') ||
    value.includes('already has an arrival') ||
    value.includes('already arrived') ||
    value.includes('currently checked in')
  );
}

function classifyMindbodyAccessError(error: unknown): MindbodyAccessErrorResult {
  if (error instanceof MbError) {
    if (error.code === 'RATE_LIMITED' || error.code === 'QUOTA_EXCEEDED') {
      return {
        granted: false,
        reasonCode: 'mindbody_unavailable',
        membershipStatus: null,
        message: 'Access unavailable. Please contact front desk.',
      };
    }

    const rawMessage = error.message.trim();
    const lower = rawMessage.toLowerCase();

    if (isAlreadyCheckedInMessage(rawMessage)) {
      return {
        granted: true,
        reasonCode: 'already_checked_in_today',
        membershipStatus: 'active',
        message: 'Access granted.',
      };
    }

    if (
      lower.includes('client not found') ||
      lower.includes('client could not be found') ||
      lower.includes('client does not exist')
    ) {
      return {
        granted: false,
        reasonCode: 'member_not_found',
        membershipStatus: null,
        message: 'Member not recognized. Please contact front desk.',
      };
    }

    if (lower.includes('suspend') || lower.includes('paused')) {
      return {
        granted: false,
        reasonCode: 'membership_paused',
        membershipStatus: 'paused',
        message: 'Membership is paused. Please contact front desk.',
      };
    }

    if (
      lower.includes('expired') ||
      lower.includes('terminated') ||
      lower.includes('inactive contract') ||
      lower.includes('contract inactive')
    ) {
      return {
        granted: false,
        reasonCode: 'membership_expired',
        membershipStatus: 'expired',
        message: 'Membership has expired. Please contact front desk.',
      };
    }

    if (lower.includes('requires payment')) {
      return {
        granted: false,
        reasonCode: 'membership_none',
        membershipStatus: 'none',
        message: 'Membership payment required. Please contact front desk.',
      };
    }

    if (
      lower.includes('no active') ||
      lower.includes('no valid') ||
      lower.includes('no visits') ||
      lower.includes('no remaining') ||
      lower.includes('membership required') ||
      lower.includes('pricing option') ||
      lower.includes('service required') ||
      lower.includes('not eligible') ||
      lower.includes('not allowed to make an arrival')
    ) {
      return {
        granted: false,
        reasonCode: 'membership_none',
        membershipStatus: 'none',
        message: 'No active membership found. Please contact front desk.',
      };
    }
  }

  return {
    granted: false,
    reasonCode: 'mindbody_unavailable',
    membershipStatus: null,
    message: 'Access unavailable. Please contact front desk.',
  };
}

async function resolveGateDevice(
  svc: SupabaseClient,
  deviceId: string,
): Promise<{ allowed: boolean; reasonCode?: AccessDecisionReasonCode; message?: string }> {
  const now = new Date().toISOString();
  const { data, error } = await svc
    .from('gate_devices')
    .select('id, enabled')
    .eq('device_id', deviceId)
    .maybeSingle<{ id: string; enabled: boolean }>();

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read gate device configuration.');
  }

  if (data) {
    await svc.from('gate_devices').update({ last_seen_at: now, updated_at: now }).eq('id', data.id);

    if (!data.enabled) {
      return {
        allowed: false,
        reasonCode: 'device_disabled',
        message: 'Access point disabled. Please contact front desk.',
      };
    }

    return { allowed: true };
  }

  if (!parseAllowedDeviceIds().has(deviceId)) {
    return {
      allowed: false,
      reasonCode: 'device_unknown',
      message: 'Access point not authorized. Please contact front desk.',
    };
  }

  await svc.from('gate_devices').upsert(
    {
      device_id: deviceId,
      label: deviceId,
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'device_id' },
  );

  return { allowed: true };
}

async function readMemberAccessContextByUserId(
  svc: SupabaseClient,
  userId: string,
): Promise<MemberAccessContext | null> {
  const [
    { data: profile, error: profileError },
    { data: link, error: linkError },
    { data: unlimited, error: unlimitedError },
    { data: memberships },
  ] = await Promise.all([
    svc
      .from('profiles')
      .select('id, full_name, avatar_url, membership_status, membership_expires_at, membership_last_synced_at, membership_source')
      .eq('id', userId)
      .maybeSingle<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        membership_status: string | null;
        membership_expires_at: string | null;
        membership_last_synced_at: string | null;
        membership_source: string | null;
      }>(),
    svc
      .from('mindbody_links')
      .select('mindbody_client_id')
      .eq('user_id', userId)
      .maybeSingle<{ mindbody_client_id: string }>(),
    svc
      .from('unlimited_access_members')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle<{ id: string; is_active: boolean }>(),
    svc
      .from('member_memberships')
      .select('id, status, end_date')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  if (profileError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read member profile.');
  }
  if (linkError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read member link.');
  }
  if (unlimitedError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read unlimited access status.');
  }
  if (!profile) return null;

  const hasActiveMirrorRow = (memberships ?? []).some((m: { end_date?: string | null }) => {
    if (!m.end_date) return true;
    return new Date(m.end_date).getTime() >= Date.now();
  });

  return {
    userId: profile.id,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    membershipStatus: profile.membership_status,
    membershipExpiresAt: profile.membership_expires_at ?? null,
    membershipLastSyncedAt: profile.membership_last_synced_at,
    membershipSource: profile.membership_source ?? null,
    mindbodyClientId: link?.mindbody_client_id ?? null,
    isUnlimitedAccess: Boolean(unlimited?.is_active),
    hasActiveMirrorRow,
  };
}

async function readMemberAccessContextByMindbodyClientId(
  svc: SupabaseClient,
  mindbodyClientId: string,
): Promise<MemberAccessContext | null> {
  const { data: link, error: linkError } = await svc
    .from('mindbody_links')
    .select('user_id, mindbody_client_id')
    .eq('mindbody_client_id', mindbodyClientId)
    .maybeSingle<{ user_id: string; mindbody_client_id: string }>();

  if (linkError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read member link.');
  }
  if (!link) return null;

  const member = await readMemberAccessContextByUserId(svc, link.user_id);
  if (!member) return null;

  return {
    ...member,
    mindbodyClientId: link.mindbody_client_id,
  };
}

async function resolveMemberAccessContext(
  svc: SupabaseClient,
  memberId: string,
): Promise<MemberAccessContext | null> {
  const trimmed = memberId.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const direct = await readMemberAccessContextByUserId(svc, trimmed);
    if (direct) return direct;
  }

  return await readMemberAccessContextByMindbodyClientId(svc, trimmed);
}

async function findRecentGrantedAttempt(
  svc: SupabaseClient,
  userId: string,
  deviceId: string,
  tokenJti: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - duplicateWindowMs()).toISOString();

  let query = svc
    .from('gate_access_attempts')
    .select('id')
    .eq('member_user_id', userId)
    .eq('device_id', deviceId)
    .eq('granted', true)
    .gte('responded_at', since)
    .limit(1);

  if (tokenJti) {
    query = query.eq('token_jti', tokenJti);
  } else {
    query = query.is('token_jti', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read gate access attempts.');
  }

  return Boolean(data);
}

/**
 * Marks a member QR token (jti) as spent on its first successful gate grant.
 *
 * Returns:
 *  - 'consumed'      the caller is the first to use this jti (proceed to grant)
 *  - 'already_used'  the jti was already consumed (by an earlier scan / the coach
 *                    path) — a fresh entry attempt on a spent pass, deny it
 *  - 'not_tracked'   no qr_tokens row exists for this jti (e.g. tokens minted by a
 *                    path that does not persist a row) — do NOT block; fall through
 *
 * The update is a conditional single-row write (is('consumed_at', null)); Postgres
 * serializes it, so two concurrent scans of the same jti cannot both see 'consumed'.
 * Same-device reader retries never reach here because findRecentGrantedAttempt short
 * -circuits them first.
 */
/**
 * Read-only check used before the Mindbody write so a member who will be denied does
 * not burn their pass. Returns true only when a qr_tokens row for this jti/user exists
 * AND is already consumed. A missing row returns false (untracked tokens are allowed
 * through — the authoritative one-shot enforcement is tryConsumeGateToken on grant).
 */
async function isGateTokenConsumed(
  svc: SupabaseClient,
  jti: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await svc
    .from('qr_tokens')
    .select('consumed_at')
    .eq('jti', jti)
    .eq('user_id', userId)
    .maybeSingle<{ consumed_at: string | null }>();

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read gate token.');
  }

  return Boolean(data?.consumed_at);
}

async function tryConsumeGateToken(
  svc: SupabaseClient,
  jti: string,
  userId: string,
): Promise<'consumed' | 'already_used' | 'not_tracked'> {
  const { data: updated, error: updateError } = await svc
    .from('qr_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('jti', jti)
    .eq('user_id', userId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (updateError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to consume gate token.');
  }
  if (updated) return 'consumed';

  // No row was updated: either the jti is already consumed, or no row exists.
  const { data: existing, error: readError } = await svc
    .from('qr_tokens')
    .select('id')
    .eq('jti', jti)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>();

  if (readError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read gate token.');
  }

  return existing ? 'already_used' : 'not_tracked';
}

/**
 * Latest facility entry today (`gate_scan` / `qr_scan`).
 * Class roll-call / Mindbody visit mirrors must not count as facility arrivals.
 */
async function findTodayCheckInId(svc: SupabaseClient, userId: string): Promise<string | null> {
  const { start, end } = gymTodayBounds();
  const { data, error } = await svc
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .in('method', ['gate_scan', 'qr_scan'])
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to read facility check-ins.');
  }

  return data?.id ?? null;
}

async function createGateCheckIn(
  svc: SupabaseClient,
  userId: string,
  options: {
    tokenJti?: string | null;
    mindbodyVisitId?: string | null;
  } = {},
): Promise<string> {
  const { data, error } = await svc
    .from('check_ins')
    .insert({
      user_id: userId,
      class_id: null,
      method: 'gate_scan',
      source: 'mindbody',
      gate_jti: options.tokenJti ?? null,
      mindbody_visit_id: options.mindbodyVisitId ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to record gate check-in.');
  }

  if (!data) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to record gate check-in.');
  }

  return data.id;
}

function isMindbodyRequiresPaymentError(error: unknown): boolean {
  if (!(error instanceof MbError)) return false;
  return error.message.toLowerCase().includes('requires payment');
}

type GateEntryResult =
  | { kind: 'granted'; checkInId: string; isRepeatFacilityToday: boolean }
  | { kind: 'token_spent' };

/**
 * Record a facility arrival. Multiple gate entries per gym-day are allowed (arrival
 * history). QR one-shot still applies: a spent jti cannot open the gate again.
 * Reader retries never reach here (findRecentGrantedAttempt short-circuits them).
 */
async function recordGateEntry(
  svc: SupabaseClient,
  member: MemberAccessContext,
  tokenJti: string | null,
  mindbodyVisitId: string | null,
  hadFacilityToday: boolean,
): Promise<GateEntryResult> {
  if (tokenJti) {
    const consumption = await tryConsumeGateToken(svc, tokenJti, member.userId);
    if (consumption === 'already_used') {
      return { kind: 'token_spent' };
    }
  }

  const checkInId = await createGateCheckIn(svc, member.userId, {
    tokenJti,
    mindbodyVisitId,
  });
  return { kind: 'granted', checkInId, isRepeatFacilityToday: hadFacilityToday };
}

async function writeMindbodyArrival(
  svc: SupabaseClient,
  clientId: string,
  init: RequestInit = {},
): Promise<string | null> {
  const locationId = parseInt(Deno.env.get('MINDBODY_LOCATION_ID') ?? '1', 10);
  const arrival = await mbFetch<ArrivalResponse>(svc, '/client/addarrival', {
    method: 'POST',
    body: JSON.stringify({
      ClientId: clientId,
      LocationId: locationId,
    }),
    ...init,
  });

  const rawId = arrival.Visit?.Id ?? arrival.ClientService?.Id;
  if (rawId === undefined || rawId === null) return null;
  return String(rawId);
}

function buildDecision(
  base: {
    type: GateAttemptType;
    requestType: string;
    member: MemberAccessContext | null;
    tokenJti: string | null;
    tokenExpiresAt: string | null;
  },
  patch: Partial<GateAccessDecision> &
    Pick<GateAccessDecision, 'granted' | 'message' | 'reasonCode'>,
): GateAccessDecision {
  return {
    granted: patch.granted,
    message: patch.message,
    reasonCode: patch.reasonCode,
    type: base.type,
    requestType: base.requestType,
    memberUserId: base.member?.userId ?? null,
    mindbodyClientId: base.member?.mindbodyClientId ?? null,
    membershipStatus: patch.membershipStatus ?? base.member?.membershipStatus ?? null,
    membershipLastSyncedAt:
      patch.membershipLastSyncedAt ?? base.member?.membershipLastSyncedAt ?? null,
    tokenJti: base.tokenJti,
    tokenExpiresAt: base.tokenExpiresAt,
    checkInId: patch.checkInId ?? null,
    arrivalJobId: patch.arrivalJobId ?? null,
    shouldEnqueueMembershipRefresh: patch.shouldEnqueueMembershipRefresh ?? false,
  };
}

async function evaluateResolvedMemberGateAccess(
  svc: SupabaseClient,
  input: {
    deviceId: string;
    type: GateAttemptType;
    requestType: string;
    member: MemberAccessContext | null;
    tokenJti: string | null;
    tokenExpiresAt: string | null;
  },
): Promise<GateAccessDecision> {
  const base = {
    type: input.type,
    requestType: input.requestType,
    member: input.member,
    tokenJti: input.tokenJti,
    tokenExpiresAt: input.tokenExpiresAt,
  };

  const device = await resolveGateDevice(svc, input.deviceId);
  if (!device.allowed) {
    return buildDecision(base, {
      granted: false,
      message: device.message ?? 'Access unavailable. Please contact front desk.',
      reasonCode: device.reasonCode ?? 'device_unknown',
    });
  }

  if (!input.member) {
    return buildDecision(base, {
      granted: false,
      message: 'Member not recognized. Please contact front desk.',
      reasonCode: 'member_not_found',
    });
  }

  if (!input.member.mindbodyClientId && !input.member.isUnlimitedAccess) {
    return buildDecision(base, {
      granted: false,
      message: 'Membership unavailable. Please contact front desk.',
      reasonCode: 'not_linked',
    });
  }

  if (await findRecentGrantedAttempt(svc, input.member.userId, input.deviceId, input.tokenJti)) {
    return buildDecision(base, {
      granted: true,
      message: 'Access granted.',
      reasonCode: 'duplicate_recent_grant',
    });
  }

  const existingCheckInId = await findTodayCheckInId(svc, input.member.userId);
  const hadFacilityToday = Boolean(existingCheckInId);

  // One-shot QR: a signed member pass may open the gate once (including re-entries
  // later the same day — refresh the pass in the app). Reader retries are already
  // handled above (same member + device within the duplicate window). We check (but
  // do not yet consume) here so a member denied by Mindbody does not burn their pass;
  // consumption happens only on a successful grant below.
  if (input.tokenJti) {
    const alreadyConsumed = await isGateTokenConsumed(svc, input.tokenJti, input.member.userId);
    if (alreadyConsumed) {
      return buildDecision(base, {
        granted: false,
        message: 'This pass was already used. Open the app to refresh your QR.',
        reasonCode: 'token_already_used',
      });
    }
  }

  const isEligibleLocally = isLocallyEligibleMembership(input.member);

  if (isEligibleLocally) {
    // FAST PATH: Member is confirmed active locally (< 150ms).
    const entry = await recordGateEntry(
      svc,
      input.member,
      input.tokenJti,
      null, // VisitId will be attached asynchronously in the background
      hadFacilityToday,
    );

    if (entry.kind === 'token_spent') {
      return buildDecision(base, {
        granted: false,
        message: 'This pass was already used. Open the app to refresh your QR.',
        reasonCode: 'token_already_used',
      });
    }

    // Write Mindbody arrival in the background for first daily facility entry
    if (input.member.mindbodyClientId && !hadFacilityToday) {
      runBackground(
        writeMindbodyArrivalAndRecord(
          svc,
          input.member.mindbodyClientId,
          entry.checkInId,
        ),
      );
    }

    return buildDecision(base, {
      granted: true,
      message: 'Access granted.',
      reasonCode: entry.isRepeatFacilityToday ? 'already_checked_in_today' : 'granted',
      membershipStatus: 'active',
      checkInId: entry.checkInId,
    });
  }

  // FALLBACK: Local mirror does not confirm fresh active membership.
  // Query Mindbody live with a strict 2.2-second timeout to protect against Gantner GT7 hardware timeout.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LIVE_FALLBACK_TIMEOUT_MS);

    let mindbodyVisitId: string | null = null;
    try {
      mindbodyVisitId = hadFacilityToday
        ? null
        : await writeMindbodyArrival(svc, input.member.mindbodyClientId, {
          signal: controller.signal,
        });
    } finally {
      clearTimeout(timeoutId);
    }

    const entry = await recordGateEntry(
      svc,
      input.member,
      input.tokenJti,
      mindbodyVisitId,
      hadFacilityToday,
    );

    if (entry.kind === 'token_spent') {
      return buildDecision(base, {
        granted: false,
        message: 'This pass was already used. Open the app to refresh your QR.',
        reasonCode: 'token_already_used',
      });
    }

    return buildDecision(base, {
      granted: true,
      message: 'Access granted.',
      reasonCode: entry.isRepeatFacilityToday ? 'already_checked_in_today' : 'granted',
      membershipStatus: 'active',
      checkInId: entry.checkInId,
      shouldEnqueueMembershipRefresh: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message?.toLowerCase().includes('abort'))
    ) {
      return buildDecision(base, {
        granted: false,
        message: 'Membership validation busy. Please contact front desk.',
        reasonCode: 'mindbody_unavailable',
        shouldEnqueueMembershipRefresh: true,
      });
    }

    const classified = classifyMindbodyAccessError(error);

    if (classified.granted) {
      // Mindbody says already arrived — still record a local facility arrival row.
      const entry = await recordGateEntry(svc, input.member, input.tokenJti, null, hadFacilityToday);
      if (entry.kind === 'token_spent') {
        return buildDecision(base, {
          granted: false,
          message: 'This pass was already used. Open the app to refresh your QR.',
          reasonCode: 'token_already_used',
        });
      }
      return buildDecision(base, {
        granted: true,
        message: classified.message,
        reasonCode: classified.reasonCode,
        membershipStatus: classified.membershipStatus,
        checkInId: entry.checkInId,
      });
    }

    // Mindbody addarrival can reject "Day pass" / comp plans with "Client requires payment"
    // even when activeclientmemberships shows a current membership. Fall back to a live
    // membership read so members with a valid plan are not blocked at the gate.
    if (isMindbodyRequiresPaymentError(error)) {
      try {
        const live = await fetchLiveMembershipEligibility(svc, input.member.mindbodyClientId);
        if (live.eligible) {
          const entry = await recordGateEntry(
            svc,
            input.member,
            input.tokenJti,
            null,
            hadFacilityToday,
          );

          if (entry.kind === 'token_spent') {
            return buildDecision(base, {
              granted: false,
              message: 'This pass was already used. Open the app to refresh your QR.',
              reasonCode: 'token_already_used',
            });
          }

          return buildDecision(base, {
            granted: true,
            message: 'Access granted.',
            reasonCode: entry.isRepeatFacilityToday ? 'already_checked_in_today' : 'granted',
            membershipStatus: 'active',
            checkInId: entry.checkInId,
            shouldEnqueueMembershipRefresh: true,
          });
        }
      } catch {
        // Fall through to the classified denial below.
      }
    }

    return buildDecision(base, {
      granted: false,
      message: classified.message,
      reasonCode: classified.reasonCode,
      membershipStatus: classified.membershipStatus,
      shouldEnqueueMembershipRefresh: classified.reasonCode !== 'mindbody_unavailable',
    });
  }
}

export async function enqueueMembershipRefreshJob(
  svc: SupabaseClient,
  userId: string,
  reason: string,
): Promise<{ id: string; created: boolean }> {
  return await enqueueSyncJob(
    svc,
    'mindbody_membership_refresh',
    {
      targetUserId: userId,
      reason,
    },
    { dedupeField: 'targetUserId' },
  );
}

export async function resolveGateMemberProfile(
  svc: SupabaseClient,
  memberId: string,
): Promise<GateMemberProfile | null> {
  const member = await resolveMemberAccessContext(svc, memberId);
  if (!member) return null;

  const fullName = member.fullName?.trim() || member.mindbodyClientId || member.userId;
  const names = splitName(member.fullName);

  return {
    memberUserId: member.userId,
    memberId,
    mindbodyClientId: member.mindbodyClientId,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName,
    displayName: fullName,
    imageBase64: imageBase64FromAvatarUrl(member.avatarUrl),
  };
}

export async function evaluateGateAccess({
  svc,
  deviceId,
  token,
  rawType,
}: EvaluateAccessInput): Promise<GateAccessDecision> {
  const type = normalizeGateAttemptType(rawType);
  const requestType = rawType?.trim() || 'QR';
  const verified = await verifyMemberQrToken(token);
  const tokenExpiresAt = new Date(verified.expEpoch * 1000).toISOString();
  const member = await readMemberAccessContextByUserId(svc, verified.memberId);

  return await evaluateResolvedMemberGateAccess(svc, {
    deviceId,
    type,
    requestType,
    member,
    tokenJti: verified.jti,
    tokenExpiresAt,
  });
}

export async function evaluateGateAccessByMemberId({
  svc,
  deviceId,
  memberId,
}: EvaluateAccessByMemberIdInput): Promise<GateAccessDecision> {
  const member = await resolveMemberAccessContext(svc, memberId);

  return await evaluateResolvedMemberGateAccess(svc, {
    deviceId,
    type: 'UNKNOWN',
    requestType: 'MemberId',
    member,
    tokenJti: null,
    tokenExpiresAt: null,
  });
}

export async function recordGateAccessAttempt(
  svc: SupabaseClient,
  input: GateAccessAttemptLog,
): Promise<void> {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const respondedAt = input.respondedAt ?? requestedAt;
  const { error } = await svc.from('gate_access_attempts').insert({
    member_user_id: input.memberUserId ?? null,
    mindbody_client_id: input.mindbodyClientId ?? null,
    device_id: input.deviceId,
    type: input.type,
    request_type: input.requestType ?? input.type,
    granted: input.granted,
    message: input.message,
    reason_code: input.reasonCode,
    membership_status: input.membershipStatus ?? null,
    membership_last_synced_at: input.membershipLastSyncedAt ?? null,
    token_jti: input.tokenJti ?? null,
    token_expires_at: input.tokenExpiresAt ?? null,
    check_in_id: input.checkInId ?? null,
    arrival_job_id: input.arrivalJobId ?? null,
    raw_request: input.rawRequest,
    raw_response: input.rawResponse,
    requested_at: requestedAt,
    responded_at: respondedAt,
  });

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to record gate access attempt.');
  }
}

export function gateResponseForDecision(decision: GateAccessDecision): {
  Granted: boolean;
  Message: string;
} {
  return decision.granted ? gateGranted(decision.message) : gateDenied(decision.message);
}

export function buildFailureResponse(message: string): { Granted: false; Message: string } {
  return gateDenied(message);
}
