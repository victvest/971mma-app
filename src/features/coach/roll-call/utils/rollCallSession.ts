import type { RollCallDeckMember, RollCallSessionView } from '@/features/coach/roll-call/types';

export function countUnmarkedDeckMembers(deck: ReadonlyArray<RollCallDeckMember>): number {
  return deck.filter((member) => member.mark === null).length;
}

export function isRollCallSessionCompleted(
  session: RollCallSessionView | null | undefined,
): boolean {
  return session?.status === 'completed';
}

export function isRollCallSessionInProgress(
  session: RollCallSessionView | null | undefined,
): boolean {
  return session?.status === 'in_progress';
}

export function isRollCallResuming(
  session: RollCallSessionView | null | undefined,
  deck: ReadonlyArray<RollCallDeckMember>,
): boolean {
  if (!isRollCallSessionInProgress(session)) return false;

  const markedCount = deck.length - countUnmarkedDeckMembers(deck);
  return markedCount > 0 || (session?.deckCursor ?? 0) > 0;
}

export function rollCallExitHasProgress(
  deck: ReadonlyArray<RollCallDeckMember>,
  session: RollCallSessionView | null | undefined,
): boolean {
  const markedCount = deck.length - countUnmarkedDeckMembers(deck);
  return markedCount > 0 || (session?.deckCursor ?? 0) > 0;
}
