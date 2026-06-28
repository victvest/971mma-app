import {
  computeRollCallSummary,
  DEFAULT_ROLL_CALL_CONFIG,
  type AbandonRollCallResponse,
  type CompleteRollCallResponse,
  type RecordRollCallMarkRequest,
  type RecordRollCallMarkResponse,
  type RollCallDeckMember,
  type RollCallMemberMark,
  type RollCallSearchResult,
  type RollCallSessionView,
  type RollCallState,
  type StartRollCallResponse,
} from '@/features/coach/roll-call/types';
import {
  getDemoCoachClassById,
  getDemoClassRoster,
  getDemoRollCallDeck,
} from '@/features/coach/demo/coachDemoFixtures';
import { computeClassRosterAttendance } from '@/services/database/coach.repository';
import { isDemoCoachClassId } from '@/features/coach/demo/coachDemoMode';
import { isEligibleForRollCallDeck } from '@/features/coach/roll-call/utils/mergeRosterWithMarks';

type DemoSessionStore = {
  session: RollCallSessionView | null;
  marksByDeckKey: Map<string, RollCallMemberMark>;
  deck: RollCallDeckMember[];
};

const stores = new Map<string, DemoSessionStore>();

function getStore(classId: string): DemoSessionStore {
  const existing = stores.get(classId);
  if (existing) return existing;

  const created: DemoSessionStore = {
    session: null,
    marksByDeckKey: new Map(),
    deck: getDemoRollCallDeck(),
  };
  stores.set(classId, created);
  return created;
}

function applyMarksToDeck(
  deck: RollCallDeckMember[],
  marksByDeckKey: Map<string, RollCallMemberMark>,
): RollCallDeckMember[] {
  return deck.map((member) => {
    const mark = marksByDeckKey.get(member.deckKey) ?? null;
    return mark ? { ...member, mark } : { ...member, mark: null };
  });
}

function buildDemoRollCallState(classId: string): RollCallState {
  const classItem = getDemoCoachClassById(classId);
  const store = getStore(classId);
  const deck = applyMarksToDeck(store.deck, store.marksByDeckKey).filter(isEligibleForRollCallDeck);
  const marks = deck
    .map((member) => member.mark)
    .filter((value): value is RollCallMemberMark => value !== null);

  return {
    session: store.session,
    classId,
    classTitle: classItem?.title ?? 'Class',
    startsAt: classItem?.startsAt ?? new Date().toISOString(),
    deck,
    summary: computeRollCallSummary(marks, deck),
    rosterCachedAt: new Date().toISOString(),
    config: DEFAULT_ROLL_CALL_CONFIG,
    rosterAttendance: computeClassRosterAttendance(getDemoClassRoster(classId).visitors),
  };
}

export function getDemoRollCallState(classId: string): RollCallState {
  return buildDemoRollCallState(classId);
}

export function demoStartRollCall(classId: string, coachId: string): StartRollCallResponse {
  const store = getStore(classId);
  const resumed = store.session?.status === 'in_progress';

  if (!store.session || store.session.status === 'completed') {
    store.session = {
      id: `demo-session-${classId}`,
      classId,
      coachId,
      status: 'in_progress',
      deckCursor: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
  }

  return {
    session: store.session,
    resumed,
  };
}

export function demoClearRollCallMark(classId: string, deckKey: string): void {
  const store = getStore(classId);
  store.marksByDeckKey.delete(deckKey);
}

export function demoRecordRollCallMark(
  input: RecordRollCallMarkRequest,
  coachId: string,
): RecordRollCallMarkResponse {
  const store = getStore(input.classId);
  if (!store.session || store.session.status !== 'in_progress') {
    throw new Error('Start roll call before marking attendance.');
  }

  const deckKey =
    input.userId ??
    (input.mindbodyClientId ? `mb:${input.mindbodyClientId}` : null);
  if (!deckKey) {
    throw new Error('Member id is required.');
  }

  const mark: RollCallMemberMark = {
    id: `demo-mark-${deckKey}-${Date.now()}`,
    status: input.status,
    method: input.method,
    markedAt: new Date().toISOString(),
    markedBy: coachId,
    metadata: input.metadata ?? {},
  };

  store.marksByDeckKey.set(deckKey, mark);

  return {
    mark,
    session: store.session,
  };
}

export function demoCompleteRollCall(sessionId: string): CompleteRollCallResponse {
  for (const store of stores.values()) {
    if (store.session?.id === sessionId) {
      store.session = {
        ...store.session,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
      const state = buildDemoRollCallState(store.session.classId);
      return {
        session: store.session,
        summary: state.summary,
      };
    }
  }
  throw new Error('Demo roll call session not found.');
}

export function demoAbandonRollCall(sessionId: string): AbandonRollCallResponse {
  for (const [classId, store] of stores.entries()) {
    if (store.session?.id === sessionId) {
      store.session = null;
      store.marksByDeckKey.clear();
      return { classId };
    }
  }
  throw new Error('Demo roll call session not found.');
}

export function demoSearchMembersForRollCall(
  classId: string,
  query: string,
): RollCallSearchResult[] {
  const normalized = query.trim().toLowerCase();
  const state = buildDemoRollCallState(classId);
  const onDeck = new Set(state.deck.map((member) => member.deckKey));

  return state.deck
    .filter((member) => member.displayName.toLowerCase().includes(normalized))
    .slice(0, 20)
    .map((member) => ({
      deckKey: member.deckKey,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      beltRank: member.beltRank,
      beltStripes: member.beltStripes,
      userId: member.userId,
      mindbodyClientId: member.mindbodyClientId,
      isOnApp: member.isOnApp,
      alreadyOnDeck: onDeck.has(member.deckKey),
    }));
}

export function shouldUseDemoRollCall(classId: string): boolean {
  return isDemoCoachClassId(classId);
}
