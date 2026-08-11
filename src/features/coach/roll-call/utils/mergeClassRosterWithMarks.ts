import type {
  RollCallDeckMember,
  RollCallMemberMark,
} from '@/features/coach/roll-call/types';

export type ClassRosterMemberSlice = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  membershipStatus: string;
  membershipActive: boolean;
  beltRank: string | null;
  beltStripes: number;
  mindbodyClientId: string;
  addedAt: string;
};

/**
 * Build today's roll-call deck from the persistent class roster + today's marks.
 * Mindbody bookings are intentionally ignored.
 */
export function mergeClassRosterWithMarks(input: {
  rosterMembers: ClassRosterMemberSlice[];
  marksByUserId: Map<string, RollCallMemberMark>;
  facilityCheckInsByUserId?: Map<string, { presentedBy: string | null }>;
}): RollCallDeckMember[] {
  const { rosterMembers, marksByUserId, facilityCheckInsByUserId } = input;

  const deck: RollCallDeckMember[] = rosterMembers.map((member) => {
    const mark = marksByUserId.get(member.userId) ?? null;
    const facility = facilityCheckInsByUserId?.get(member.userId);
    return {
      deckKey: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      beltRank: member.beltRank,
      beltStripes: member.beltStripes,
      userId: member.userId,
      mindbodyClientId: member.mindbodyClientId || member.userId,
      mark,
      isOnApp: true,
      isBookedOnRoster: false,
      hasFacilityCheckInToday: Boolean(facility),
      isWalkIn: false,
      isGuest: false,
      presentedBy: facility?.presentedBy ?? null,
      membershipStatus: member.membershipStatus,
      membershipActive: member.membershipActive,
      addedAt: member.addedAt,
    } as RollCallDeckMember;
  });

  // Unmarked first (A–Z), then non-QR marked (A–Z), then QR-scanned at the end (A–Z).
  deck.sort((a, b) => {
    const rank = (member: RollCallDeckMember) => {
      if (!member.mark) return 0;
      if (member.mark.method === 'qr_scan') return 2;
      return 1;
    };
    const rankDelta = rank(a) - rank(b);
    if (rankDelta !== 0) return rankDelta;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  });

  return deck;
}

export function marksMapFromRpcDeck(
  deck: Array<{ userId: string | null; mark: RollCallMemberMark | null }>,
): Map<string, RollCallMemberMark> {
  const map = new Map<string, RollCallMemberMark>();
  for (const row of deck) {
    if (row.userId && row.mark) map.set(row.userId, row.mark);
  }
  return map;
}
