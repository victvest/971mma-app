import { computeClassRosterAttendance, fetchClassRoster } from '@/services/database/coach.repository';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  demoAbandonRollCall,
  demoClearRollCallMark,
  demoCompleteRollCall,
  demoRecordRollCallMark,
  demoSearchMembersForRollCall,
  demoStartRollCall,
  getDemoRollCallState,
  shouldUseDemoRollCall,
} from '@/features/coach/demo/coachDemoRollCallStore';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import type { ProfileRow } from '@/types/database';
import type {
  CompleteRollCallResponse,
  RecordRollCallMarkRequest,
  RecordRollCallMarkResponse,
  AbandonRollCallResponse,
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallSessionView,
  RollCallState,
  RollCallSummary,
  RollCallSearchResult,
  StartRollCallResponse,
} from '@/features/coach/roll-call/types';
import {
  marksMapFromDeckMembers,
  mergeRosterWithMarks,
  type RollCallFacilitySlice,
  type RollCallProfileSlice,
} from '@/features/coach/roll-call/utils/mergeRosterWithMarks';
import { DEFAULT_ROLL_CALL_CONFIG, type RollCallConfig } from '@/features/coach/roll-call/types';

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

function mapDeckMember(row: RpcDeckMember): RollCallDeckMember {
  return {
    deckKey: row.deckKey,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    beltRank: row.beltRank,
    beltStripes: row.beltStripes ?? 0,
    userId: row.userId,
    mindbodyClientId: row.mindbodyClientId,
    mark: row.mark ? mapMark(row.mark) : null,
    isOnApp: row.isOnApp,
    isBookedOnRoster: row.isBookedOnRoster,
    hasFacilityCheckInToday: row.hasFacilityCheckInToday,
    isWalkIn: row.isWalkIn,
    isGuest: row.isGuest,
    presentedBy: row.presentedBy,
  };
}

function mapRollCallConfig(raw?: RpcRollCallConfig | null): RollCallConfig {
  return {
    autoFacilityCheckinOnPresent:
      raw?.autoFacilityCheckinOnPresent ?? DEFAULT_ROLL_CALL_CONFIG.autoFacilityCheckinOnPresent,
    lateCountsAsPresent:
      raw?.lateCountsAsPresent ?? DEFAULT_ROLL_CALL_CONFIG.lateCountsAsPresent,
    notifyMemberOnPresent:
      raw?.notifyMemberOnPresent ?? DEFAULT_ROLL_CALL_CONFIG.notifyMemberOnPresent,
    notifyMemberOnAbsent:
      raw?.notifyMemberOnAbsent ?? DEFAULT_ROLL_CALL_CONFIG.notifyMemberOnAbsent,
  };
}

function mapRpcState(raw: RpcRollCallState, rosterAttendance: RollCallState['rosterAttendance']): RollCallState {
  return {
    session: raw.session,
    classId: raw.classId,
    classTitle: raw.classTitle,
    startsAt: raw.startsAt,
    deck: (raw.deck ?? []).map(mapDeckMember),
    summary: raw.summary,
    rosterCachedAt: raw.rosterCachedAt,
    config: mapRollCallConfig(raw.config),
    rosterAttendance,
  };
}

async function fetchRollCallProfileMap(
  userIds: string[],
): Promise<Map<string, RollCallProfileSlice>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, avatar_url, belt_rank, belt_stripes')
    .in('id', uniqueIds);

  if (error) throw error;

  const map = new Map<string, RollCallProfileSlice>();
  for (const row of (data ?? []) as Pick<
    ProfileRow,
    'id' | 'full_name' | 'avatar_url' | 'belt_rank' | 'belt_stripes'
  >[]) {
    map.set(row.id, {
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      beltRank: row.belt_rank,
      beltStripes: row.belt_stripes ?? 0,
    });
  }
  return map;
}

async function fetchFacilityCheckInsForRollCall(
  userIds: string[],
): Promise<Map<string, RollCallFacilitySlice>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await getSupabaseClient().rpc('roll_call_facility_check_ins', {
    p_user_ids: uniqueIds,
  });
  if (error) throw error;

  const map = new Map<string, RollCallFacilitySlice>();
  for (const row of (data ?? []) as RpcFacilityCheckIn[]) {
    map.set(row.userId, { presentedBy: row.presentedBy ?? null });
  }
  return map;
}

export async function getRollCallState(classId: string): Promise<RollCallState> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return getDemoRollCallState(classId);
  }

  const client = getSupabaseClient();

  const [{ data, error }, roster] = await Promise.all([
    client.rpc('get_roll_call_state', { p_class_id: classId }),
    fetchClassRoster(classId),
  ]);

  if (error) throw error;

  const rosterAttendance = computeClassRosterAttendance(roster.visitors);
  const rpcState = mapRpcState(data as RpcRollCallState, rosterAttendance);
  const marksByDeckKey = marksMapFromDeckMembers(rpcState.deck);

  const linkedUserIds = [
    ...roster.visitors.map((visitor) => visitor.userId),
    ...rpcState.deck.map((member) => member.userId),
  ].filter((id): id is string => Boolean(id));

  const uniqueUserIds = [...new Set(linkedUserIds)];
  const [profilesByUserId, facilityCheckInsByUserId] = await Promise.all([
    fetchRollCallProfileMap(uniqueUserIds),
    fetchFacilityCheckInsForRollCall(uniqueUserIds),
  ]);
  const deck = mergeRosterWithMarks({
    roster,
    marksByDeckKey,
    profilesByUserId,
    facilityCheckInsByUserId,
  });

  return {
    ...rpcState,
    deck,
    rosterCachedAt: roster.cached ? rpcState.rosterCachedAt : new Date().toISOString(),
  };
}

export async function startRollCall(classId: string): Promise<StartRollCallResponse> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    const coachId = 'demo-coach-user';
    return demoStartRollCall(classId, coachId);
  }

  const { data, error } = await getSupabaseClient().rpc('start_roll_call', {
    p_class_id: classId,
  });
  if (error) throw error;
  return data as StartRollCallResponse;
}

export async function recordRollCallMark(
  input: RecordRollCallMarkRequest,
): Promise<RecordRollCallMarkResponse> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(input.classId)) {
    return demoRecordRollCallMark(input, 'demo-coach-user');
  }

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
}

export type ClearRollCallMarkInput = {
  markId: string;
  classId: string;
  deckKey: string;
};

export async function clearRollCallMark(input: ClearRollCallMarkInput): Promise<void> {
  const { markId, classId, deckKey } = input;

  if (markId.startsWith('optimistic-')) return;

  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    demoClearRollCallMark(classId, deckKey);
    return;
  }

  if (markId.startsWith('queued-')) return;

  const { error } = await getSupabaseClient()
    .from('class_session_attendance')
    .delete()
    .eq('id', markId);

  if (error) throw error;
}

export async function completeRollCall(sessionId: string): Promise<CompleteRollCallResponse> {
  if (isCoachDemoMode() && sessionId.startsWith('demo-session-')) {
    return demoCompleteRollCall(sessionId);
  }

  const { data, error } = await getSupabaseClient().rpc('complete_roll_call', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data as CompleteRollCallResponse;
}

export async function abandonRollCall(sessionId: string): Promise<AbandonRollCallResponse> {
  if (isCoachDemoMode() && sessionId.startsWith('demo-session-')) {
    return demoAbandonRollCall(sessionId);
  }

  const { data, error } = await getSupabaseClient().rpc('abandon_roll_call', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data as AbandonRollCallResponse;
}

export async function searchMembersForRollCall(
  classId: string,
  query: string,
  limit = 20,
): Promise<RollCallSearchResult[]> {
  if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
    return demoSearchMembersForRollCall(classId, query).slice(0, limit);
  }

  const { data, error } = await getSupabaseClient().rpc('search_members_for_roll_call', {
    p_class_id: classId,
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as RollCallSearchResult[];
}
