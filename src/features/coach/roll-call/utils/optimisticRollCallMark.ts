import type {
  RecordRollCallMarkInput,
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallMemberStatus,
  RollCallState,
} from '@/features/coach/roll-call/types';
import { computeRollCallSummary } from '@/features/coach/roll-call/types';
import type { RollCallSwipeCommit } from '@/features/coach/roll-call/utils/rollCallGestures';

export function swipeCommitToStatus(
  direction: RollCallSwipeCommit,
): Extract<RollCallMemberStatus, 'present' | 'absent'> {
  return direction === 'attended' ? 'present' : 'absent';
}

export function buildOptimisticRollCallMark(
  status: RollCallMemberStatus,
  markedBy: string,
): RollCallMemberMark {
  return {
    id: `optimistic-${Date.now()}`,
    status,
    method: 'roll_call',
    markedAt: new Date().toISOString(),
    markedBy,
    metadata: {},
  };
}

/** Marks that exist only in the client cache and still need a final server flush. */
export function isUnsyncedRollCallMark(mark: RollCallMemberMark | null | undefined): boolean {
  if (!mark) return false;
  return (
    mark.id.startsWith('optimistic-') ||
    mark.id.startsWith('queued-') ||
    mark.id.startsWith('local-temp-mark-')
  );
}

/**
 * Keep in-progress local marks when a refetch returns a roster without them yet.
 * Server roster membership stays authoritative; unsynced marks stay local until submit.
 * Never revive marks when there is no active session (Discard / completed).
 */
export function preserveUnsyncedDeckMarks(
  cached: RollCallState | undefined,
  fresh: RollCallState,
): RollCallState {
  if (!cached?.deck.length) return fresh;
  if (!fresh.session || fresh.session.status !== 'in_progress') {
    return fresh;
  }
  if (!cached.session || cached.session.id !== fresh.session.id) {
    // New session after abandon/restart — do not carry prior local marks.
    return fresh;
  }

  const cachedByKey = new Map(cached.deck.map((member) => [member.deckKey, member] as const));
  const deck = fresh.deck.map((server) => {
    const local = cachedByKey.get(server.deckKey);
    if (!local?.mark) return server;
    if (isUnsyncedRollCallMark(local.mark)) {
      return {
        ...server,
        mark: local.mark,
        isWalkIn: local.isWalkIn || server.isWalkIn,
        isGuest: local.isGuest || server.isGuest,
      };
    }
    return server;
  });

  const marks = deck
    .map((member) => member.mark)
    .filter((value): value is RollCallMemberMark => value !== null);

  return {
    ...fresh,
    deck,
    summary: computeRollCallSummary(marks, deck),
  };
}

export function patchRollCallDeckMark(
  state: RollCallState,
  deckKey: string,
  mark: RollCallMemberMark | null,
): RollCallState {
  const deck = state.deck.map((member) =>
    member.deckKey === deckKey ? { ...member, mark } : member,
  );
  const marks = deck
    .map((member) => member.mark)
    .filter((value): value is RollCallMemberMark => value !== null);

  return {
    ...state,
    deck,
    summary: computeRollCallSummary(marks, deck),
  };
}

export function applyOptimisticRollCallMark(
  state: RollCallState,
  input: RecordRollCallMarkInput,
  deckKey: string,
  markedBy: string,
): RollCallState {
  const mark = buildOptimisticRollCallMark(input.status, markedBy);
  const existing = state.deck.find((member) => member.deckKey === deckKey);
  if (existing) {
    return patchRollCallDeckMark(state, deckKey, { ...mark, method: input.method ?? mark.method });
  }

  // Scan-to-add: member may not be on the persistent list yet.
  const inserted: RollCallDeckMember = {
    deckKey,
    displayName: 'Member',
    avatarUrl: null,
    beltRank: null,
    beltStripes: 0,
    userId: input.userId,
    mindbodyClientId: input.mindbodyClientId ?? '',
    mark: { ...mark, method: input.method ?? mark.method },
    isOnApp: Boolean(input.userId),
    isBookedOnRoster: false,
    hasFacilityCheckInToday: false,
    isWalkIn: false,
    isGuest: false,
    presentedBy: null,
  };

  const deck = [inserted, ...state.deck];
  const marks = deck
    .map((member) => member.mark)
    .filter((value): value is RollCallMemberMark => value !== null);

  return {
    ...state,
    deck,
    summary: computeRollCallSummary(marks, deck),
  };
}

export function upsertOptimisticRosterMember(
  state: RollCallState,
  member: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    membershipStatus: string;
    membershipActive: boolean;
    mindbodyClientId?: string | null;
    beltRank?: string | null;
    beltStripes?: number;
  },
  mark: RollCallMemberMark,
): RollCallState {
  const deckKey = member.userId;
  const nextMember: RollCallDeckMember = {
    deckKey,
    displayName: member.fullName,
    avatarUrl: member.avatarUrl,
    beltRank: member.beltRank ?? null,
    beltStripes: member.beltStripes ?? 0,
    userId: member.userId,
    mindbodyClientId: member.mindbodyClientId ?? '',
    mark,
    isOnApp: true,
    isBookedOnRoster: false,
    hasFacilityCheckInToday: false,
    isWalkIn: false,
    isGuest: false,
    presentedBy: null,
    membershipStatus: member.membershipStatus,
    membershipActive: member.membershipActive,
  };

  const without = state.deck.filter((row) => row.deckKey !== deckKey);
  const deck = [nextMember, ...without];
  const marks = deck
    .map((row) => row.mark)
    .filter((value): value is RollCallMemberMark => value !== null);

  return {
    ...state,
    deck,
    summary: computeRollCallSummary(marks, deck),
  };
}

export function findDeckMemberByInput(
  deck: RollCallDeckMember[],
  input: RecordRollCallMarkInput,
): RollCallDeckMember | undefined {
  const deckKey = input.userId ?? (input.mindbodyClientId ? `mb:${input.mindbodyClientId}` : null);
  if (!deckKey) return undefined;
  return deck.find((member) => member.deckKey === deckKey);
}
