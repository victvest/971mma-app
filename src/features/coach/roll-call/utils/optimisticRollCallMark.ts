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
  return patchRollCallDeckMark(state, deckKey, mark);
}

export function findDeckMemberByInput(
  deck: RollCallDeckMember[],
  input: RecordRollCallMarkInput,
): RollCallDeckMember | undefined {
  const deckKey =
    input.userId ?? (input.mindbodyClientId ? `mb:${input.mindbodyClientId}` : null);
  if (!deckKey) return undefined;
  return deck.find((member) => member.deckKey === deckKey);
}
