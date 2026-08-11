import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { isGymToday } from '@/core/time/gymTime';

export function isQrScanMarkedMember(member: RollCallDeckMember): boolean {
  return member.mark?.method === 'qr_scan';
}

/** Members already present via QR who still belong in the swipe pass for recognition. */
export function countQrScanMarkedMembers(members: ReadonlyArray<RollCallDeckMember>): number {
  return members.filter(isQrScanMarkedMember).length;
}

/**
 * Unmarked members who belong in the swipe deck.
 * Gate / facility check-in today is required for roster members; walk-ins the coach
 * added stay in the deck even without a facility row.
 */
export function isEligibleForUnmarkedRollCallSwipe(member: RollCallDeckMember): boolean {
  if (member.mark !== null) return false;
  if (member.hasFacilityCheckInToday) return true;
  if (member.isWalkIn) return true;
  if (member.addedAt && isGymToday(member.addedAt)) return true;
  return false;
}

function compareSwipeUnmarked(a: RollCallDeckMember, b: RollCallDeckMember): number {
  if (a.hasFacilityCheckInToday !== b.hasFacilityCheckInToday) {
    return a.hasFacilityCheckInToday ? -1 : 1;
  }
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

/**
 * Swipe order: checked-in unmarked first (then walk-ins), then QR-scanned present
 * members at the end (so coaches still see who checked in via scan before summary).
 *
 * Roster members without a facility check-in today are omitted — they appear on the
 * summary list instead with a "Not here" badge.
 */
export function buildRollCallSwipeQueue(
  members: ReadonlyArray<RollCallDeckMember>,
  reviewedQrKeys: ReadonlySet<string> = new Set(),
): RollCallDeckMember[] {
  const unmarked: RollCallDeckMember[] = [];
  const qrAtEnd: RollCallDeckMember[] = [];

  for (const member of members) {
    if (isEligibleForUnmarkedRollCallSwipe(member)) {
      unmarked.push(member);
      continue;
    }
    if (isQrScanMarkedMember(member) && !reviewedQrKeys.has(member.deckKey)) {
      qrAtEnd.push(member);
    }
  }

  unmarked.sort(compareSwipeUnmarked);

  return [...unmarked, ...qrAtEnd];
}

/**
 * Append newly eligible swipe keys (new unmarked / QR) without reshuffling the
 * coach's current pass. Drops keys that left the roster or are no longer swipe-eligible.
 */
export function mergeSwipeQueueKeys(
  previousKeys: ReadonlyArray<string>,
  members: ReadonlyArray<RollCallDeckMember>,
  reviewedQrKeys: ReadonlySet<string> = new Set(),
): string[] {
  const nextEligible = buildRollCallSwipeQueue(members, reviewedQrKeys).map(
    (member) => member.deckKey,
  );
  const eligibleSet = new Set(nextEligible);
  const kept = previousKeys.filter((key) => eligibleSet.has(key));
  const keptSet = new Set(kept);
  const additions = nextEligible.filter((key) => !keptSet.has(key));
  return [...kept, ...additions];
}
