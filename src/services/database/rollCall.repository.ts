import { invokeEdge } from '@/services/mindbody/edgeClient';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  demoAbandonRollCall,
  demoAddRollCallClassMember,
  demoClearRollCallMark,
  demoCompleteRollCall,
  demoGetRollCallMemberPreview,
  demoRecordRollCallMark,
  demoRemoveRollCallClassMember,
  demoSearchMembersForRollCall,
  demoStartRollCall,
  getDemoRollCallState,
  shouldUseDemoRollCall,
} from '@/features/coach/demo/coachDemoRollCallStore';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import type {
  AddRollCallClassMemberResponse,
  CompleteRollCallResponse,
  RecordRollCallMarkRequest,
  RecordRollCallMarkResponse,
  AbandonRollCallResponse,
  RemoveRollCallClassMemberResponse,
  RollCallClassRosterMember,
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallPreviewResult,
  RollCallSessionView,
  RollCallState,
  RollCallSummary,
  RollCallSearchResult,
  StartRollCallResponse,
  RollCallMemberPreview,
} from '@/features/coach/roll-call/types';
import {
  countsAsPresentForSession,
  DEFAULT_ROLL_CALL_CONFIG,
  type RollCallConfig,
} from '@/features/coach/roll-call/types';
import {
  mergeClassRosterWithMarks,
  marksMapFromRpcDeck,
  type ClassRosterMemberSlice,
} from '@/features/coach/roll-call/utils/mergeClassRosterWithMarks';
import { resolveRollCallSummary } from '@/features/coach/roll-call/utils/resolveRollCallSummary';
import {
  clearLocalTempRollCallMark,
  isLocalTempRollCallUser,
  mergeLocalTempSeedIntoDeck,
  recordLocalTempRollCallMark,
  removeLocalTempRollCallMember,
  ROLL_CALL_LOCAL_TEMP_SEED_ENABLED,
} from '@/features/coach/roll-call/fixtures/rollCallLocalTempSeed';

type RpcMark = {
  id: string;
  status: RollCallMemberMark['status'];
  method: RollCallMemberMark['method'];
  markedAt: string;
  markedBy: string;
  metadata: RollCallMemberMark['metadata'];
};

type RpcDeckMember = {
  deckKey: string;
  displayName: string;
  avatarUrl: string | null;
  beltRank: string | null;
  beltStripes: number;
  userId: string | null;
  mindbodyClientId: string;
  mark: RpcMark | null;
  isOnApp: boolean;
  isBookedOnRoster: boolean;
  hasFacilityCheckInToday: boolean;
  isWalkIn: boolean;
  isGuest: boolean;
  presentedBy: string | null;
};

type RpcRollCallConfig = {
  autoFacilityCheckinOnPresent: boolean;
  lateCountsAsPresent: boolean;
  notifyMemberOnPresent?: boolean;
  notifyMemberOnAbsent?: boolean;
};

type RpcFacilityCheckIn = {
  userId: string;
  presentedBy: string | null;
};

type RpcRollCallState = {
  session: RollCallSessionView | null;
  classId: string;
  classTitle: string;
  startsAt: string;
  deck: RpcDeckMember[];
  summary: RollCallSummary;
  rosterCachedAt: string | null;
  config?: RpcRollCallConfig | null;
};

function mapMark(row: RpcMark): RollCallMemberMark {
  return {
    id: row.id,
    status: row.status,
    method: row.method,
    markedAt: row.markedAt,
    markedBy: row.markedBy,
    metadata: row.metadata ?? {},
  };
}

function mapRollCallConfig(raw?: RpcRollCallConfig | null): RollCallConfig {
  return {
    autoFacilityCheckinOnPresent:
      raw?.autoFacilityCheckinOnPresent ?? DEFAULT_ROLL_CALL_CONFIG.autoFacilityCheckinOnPresent,
    lateCountsAsPresent: raw?.lateCountsAsPresent ?? DEFAULT_ROLL_CALL_CONFIG.lateCountsAsPresent,
    notifyMemberOnPresent:
      raw?.notifyMemberOnPresent ?? DEFAULT_ROLL_CALL_CONFIG.notifyMemberOnPresent,
    notifyMemberOnAbsent:
      raw?.notifyMemberOnAbsent ?? DEFAULT_ROLL_CALL_CONFIG.notifyMemberOnAbsent,
  };
}

function mapRpcClassRosterMember(row: RollCallClassRosterMember): ClassRosterMemberSlice {
  return {
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    membershipStatus: row.membershipStatus,
    membershipActive: row.membershipActive,
    beltRank: row.beltRank,
    beltStripes: row.beltStripes ?? 0,
    mindbodyClientId: row.mindbodyClientId ?? row.userId,
    addedAt: row.addedAt,
  };
}

function computeRosterAttendanceFromDeck(
  deck: RollCallDeckMember[],
  config: RollCallConfig,
): RollCallState['rosterAttendance'] {
  if (deck.length === 0) {
    return { checkedIn: 0, missing: 0 };
  }

  let checkedIn = 0;
  let missing = 0;

  for (const member of deck) {
    if (member.mark) {
      if (countsAsPresentForSession(member.mark.status, config)) {
        checkedIn += 1;
      } else if (member.mark.status === 'absent') {
        missing += 1;
      }
      continue;
    }

    missing += 1;
  }

  return { checkedIn, missing };
}

async function fetchFacilityCheckInsForRollCall(
  userIds: string[],
): Promise<Map<string, { presentedBy: string | null }>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await getSupabaseClient().rpc('roll_call_facility_check_ins', {
    p_user_ids: uniqueIds,
  });
  if (error) throw error;

  const map = new Map<string, { presentedBy: string | null }>();
  for (const row of (data ?? []) as RpcFacilityCheckIn[]) {
    map.set(row.userId, { presentedBy: row.presentedBy ?? null });
  }
  return map;
}

export async function listRollCallClassMembers(classId: string): Promise<ClassRosterMemberSlice[]> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    const demo = getDemoRollCallState(classId);
    return demo.deck
      .filter((member): member is RollCallDeckMember & { userId: string } => Boolean(member.userId))
      .map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        membershipStatus: member.membershipStatus ?? 'unknown',
        membershipActive: member.membershipActive ?? false,
        beltRank: member.beltRank,
        beltStripes: member.beltStripes,
        mindbodyClientId: member.mindbodyClientId,
        addedAt: new Date().toISOString(),
      }));
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('list_roll_call_class_members', {
      p_class_id: classId,
    });
    if (error) throw error;

    return ((data ?? []) as RollCallClassRosterMember[]).map(mapRpcClassRosterMember);
  } catch (err) {
    if (classId.startsWith('demo-')) {
      console.warn('listRollCallClassMembers failed, falling back to demo:', err);
      const demo = getDemoRollCallState(classId);
      return demo.deck
        .filter((member): member is RollCallDeckMember & { userId: string } => Boolean(member.userId))
        .map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          membershipStatus: member.membershipStatus ?? 'unknown',
          membershipActive: member.membershipActive ?? false,
          beltRank: member.beltRank,
          beltStripes: member.beltStripes,
          mindbodyClientId: member.mindbodyClientId,
          addedAt: new Date().toISOString(),
        }));
    }
    console.warn('listRollCallClassMembers failed:', err);
    throw err;
  }
}

export async function getRollCallMemberPreview(userId: string): Promise<RollCallPreviewResult> {
  if (isCoachDemoMode()) {
    const demoResult = demoGetRollCallMemberPreview(userId);
    if (demoResult.ok) {
      return demoResult;
    }
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('get_roll_call_member_preview', {
      p_user_id: userId,
    });
    if (error) {
      // Surface the actual Supabase/Postgres error for debugging.
      const rawCode = (error as any).code as string | undefined;
      const rawMessage = error.message ?? '';
      console.warn('getRollCallMemberPreview RPC error:', rawCode, rawMessage, error);
      return {
        ok: false,
        code: rawCode === 'PGRST301' ? 'UNAUTHORIZED' : 'UNKNOWN_MEMBER',
        message: rawMessage || 'We could not load this member preview.',
      };
    }
    if (!data) {
      console.warn('getRollCallMemberPreview: RPC returned null data for userId', userId);
      return {
        ok: false,
        code: 'UNKNOWN_MEMBER',
        message: 'We could not find this member in the academy app.',
      };
    }
    return data as RollCallPreviewResult;
  } catch (err) {
    console.warn('getRollCallMemberPreview exception:', err);
    return {
      ok: false,
      code: 'UNKNOWN_MEMBER',
      message: 'We could not load this member preview.',
    };
  }
}

export async function addRollCallClassMember(
  classId: string,
  userId: string,
  preview?: Partial<RollCallMemberPreview>,
): Promise<AddRollCallClassMemberResponse> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return demoAddRollCallClassMember(classId, userId, preview);
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('add_roll_call_class_member', {
      p_class_id: classId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data as AddRollCallClassMemberResponse;
  } catch (err) {
    console.warn('addRollCallClassMember failed:', err);
    throw err;
  }
}

export async function removeRollCallClassMember(
  classId: string,
  userId: string,
): Promise<RemoveRollCallClassMemberResponse> {
  if (ROLL_CALL_LOCAL_TEMP_SEED_ENABLED && isLocalTempRollCallUser(userId)) {
    removeLocalTempRollCallMember(classId, userId);
    return { removed: true, listKey: `local-temp:${classId}`, userId };
  }

  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return demoRemoveRollCallClassMember(classId, userId);
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('remove_roll_call_class_member', {
      p_class_id: classId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data as RemoveRollCallClassMemberResponse;
  } catch (err) {
    console.warn('removeRollCallClassMember failed:', err);
    throw err;
  }
}

export async function getRollCallState(classId: string): Promise<RollCallState> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return getDemoRollCallState(classId);
  }

  try {
    const client = getSupabaseClient();

    const [stateResult, rosterResult] = await Promise.all([
      client.rpc('get_roll_call_state', { p_class_id: classId }),
      client.rpc('list_roll_call_class_members', { p_class_id: classId }),
    ]);

    if (stateResult.error) throw stateResult.error;
    if (rosterResult.error) throw rosterResult.error;

    const raw = stateResult.data as RpcRollCallState;
    const config = mapRollCallConfig(raw.config);
    const marksByUserId = marksMapFromRpcDeck(
      (raw.deck ?? []).map((row) => ({
        userId: row.userId,
        mark: row.mark ? mapMark(row.mark) : null,
      })),
    );

    const rosterMembers = ((rosterResult.data ?? []) as RollCallClassRosterMember[]).map(
      mapRpcClassRosterMember,
    );
    const rosterUserIds = rosterMembers.map((member) => member.userId);
    const facilityCheckInsByUserId = await fetchFacilityCheckInsForRollCall(rosterUserIds);

    const deck = mergeLocalTempSeedIntoDeck(
      classId,
      mergeClassRosterWithMarks({
        rosterMembers,
        marksByUserId,
        facilityCheckInsByUserId,
      }),
    );

    return {
      session: raw.session,
      classId: raw.classId,
      classTitle: raw.classTitle,
      startsAt: raw.startsAt,
      deck,
      summary: resolveRollCallSummary({ deck, config }),
      rosterCachedAt: raw.rosterCachedAt,
      config,
      rosterAttendance: computeRosterAttendanceFromDeck(deck, config),
    };
  } catch (err) {
    // Never map a live class onto the demo store — that made session look null forever
    // and auto-start + invalidate looped endlessly.
    if (classId.startsWith('demo-')) {
      console.warn('getRollCallState failed, falling back to demo state:', err);
      return getDemoRollCallState(classId);
    }
    console.warn('getRollCallState failed:', err);
    throw err;
  }
}

export async function startRollCall(classId: string): Promise<StartRollCallResponse> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    const coachId = 'demo-coach-user';
    return demoStartRollCall(classId, coachId);
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('start_roll_call', {
      p_class_id: classId,
    });
    if (error) throw error;
    return data as StartRollCallResponse;
  } catch (err) {
    if (classId.startsWith('demo-')) {
      console.warn('startRollCall failed, falling back to demo:', err);
      return demoStartRollCall(classId, 'demo-coach-user');
    }
    console.warn('startRollCall failed:', err);
    throw err;
  }
}

export async function recordRollCallMark(
  input: RecordRollCallMarkRequest,
): Promise<RecordRollCallMarkResponse> {
  if (ROLL_CALL_LOCAL_TEMP_SEED_ENABLED && isLocalTempRollCallUser(input.userId)) {
    return recordLocalTempRollCallMark(input, null);
  }

  if (isCoachDemoMode() && shouldUseDemoRollCall(input.classId)) {
    return demoRecordRollCallMark(input, 'demo-coach-user');
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('record_roll_call_mark', {
      p_class_id: input.classId,
      p_user_id: input.userId,
      p_mindbody_client_id: input.mindbodyClientId,
      p_status: input.status,
      p_method: input.method,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return data as RecordRollCallMarkResponse;
  } catch (err) {
    if (input.classId.startsWith('demo-')) {
      console.warn('recordRollCallMark failed, falling back to demo:', err);
      return demoRecordRollCallMark(input, 'demo-coach-user');
    }
    console.warn('recordRollCallMark failed:', err);
    throw err;
  }
}

export type ClearRollCallMarkInput = {
  markId: string;
  classId: string;
  deckKey: string;
};

export async function clearRollCallMark(input: ClearRollCallMarkInput): Promise<void> {
  const { markId, classId, deckKey } = input;

  if (markId.startsWith('optimistic-')) return;

  if (
    ROLL_CALL_LOCAL_TEMP_SEED_ENABLED &&
    (isLocalTempRollCallUser(deckKey) || markId.startsWith('local-temp-mark-'))
  ) {
    clearLocalTempRollCallMark(classId, deckKey);
    return;
  }

  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    demoClearRollCallMark(classId, deckKey);
    return;
  }

  if (markId.startsWith('queued-')) return;

  try {
    const { error } = await getSupabaseClient()
      .from('class_session_attendance')
      .delete()
      .eq('id', markId);

    if (error) throw error;
  } catch (err) {
    if (classId.startsWith('demo-')) {
      console.warn('clearRollCallMark failed, falling back to demo:', err);
      demoClearRollCallMark(classId, deckKey);
      return;
    }
    console.warn('clearRollCallMark failed:', err);
    throw err;
  }
}

export async function completeRollCall(sessionId: string): Promise<CompleteRollCallResponse> {
  if (isCoachDemoMode() && sessionId.startsWith('demo-session-')) {
    return demoCompleteRollCall(sessionId);
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('complete_roll_call', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return data as CompleteRollCallResponse;
  } catch (err) {
    if (sessionId.startsWith('demo-session-')) {
      console.warn('completeRollCall failed, falling back to demo:', err);
      return demoCompleteRollCall(sessionId);
    }
    console.warn('completeRollCall failed:', err);
    throw err;
  }
}

export async function abandonRollCall(sessionId: string): Promise<AbandonRollCallResponse> {
  if (isCoachDemoMode() && sessionId.startsWith('demo-session-')) {
    return demoAbandonRollCall(sessionId);
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('abandon_roll_call', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return data as AbandonRollCallResponse;
  } catch (err) {
    if (sessionId.startsWith('demo-session-')) {
      console.warn('abandonRollCall failed, falling back to demo:', err);
      return demoAbandonRollCall(sessionId);
    }
    console.warn('abandonRollCall failed:', err);
    throw err;
  }
}

export async function searchMembersForRollCall(
  classId: string,
  query: string,
  limit = 20,
): Promise<RollCallSearchResult[]> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return demoSearchMembersForRollCall(classId, query).slice(0, limit);
  }

  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const [localResult, remoteResult] = await Promise.all([
      getSupabaseClient().rpc('search_members_for_roll_call', {
        p_class_id: classId,
        p_query: trimmed,
        p_limit: limit,
      }),
      invokeEdge<{ results: RollCallSearchResult[] }>('mb-coach-client-search', {
        query: trimmed,
        classId,
        limit,
      }).catch(() => ({ results: [] as RollCallSearchResult[] })),
    ]);

    if (localResult.error) throw localResult.error;

    const local = (localResult.data ?? []) as RollCallSearchResult[];
    const remote = remoteResult.results ?? [];
    const merged = new Map<string, RollCallSearchResult>();

    for (const result of [...local, ...remote]) {
      const key = result.userId ?? result.mindbodyClientId ?? result.deckKey;
      if (!merged.has(key)) {
        merged.set(key, result);
        continue;
      }

      const existing = merged.get(key)!;
      merged.set(key, {
        ...existing,
        displayName: existing.displayName || result.displayName,
        avatarUrl: existing.avatarUrl ?? result.avatarUrl,
        beltRank: existing.beltRank ?? result.beltRank,
        beltStripes: existing.beltStripes ?? result.beltStripes,
        userId: existing.userId ?? result.userId,
        mindbodyClientId: existing.mindbodyClientId ?? result.mindbodyClientId,
        isOnApp: existing.isOnApp || result.isOnApp,
        alreadyOnDeck: existing.alreadyOnDeck || result.alreadyOnDeck,
      });
    }

    return Array.from(merged.values()).slice(0, limit);
  } catch (err) {
    if (classId.startsWith('demo-')) {
      console.warn('searchMembersForRollCall failed, falling back to demo:', err);
      return demoSearchMembersForRollCall(classId, query).slice(0, limit);
    }
    console.warn('searchMembersForRollCall failed:', err);
    throw err;
  }
}
