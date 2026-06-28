import type { ClassRosterResponse } from '@/types/domain';
import type {
  RollCallDeckMember,
  RollCallMemberMark,
} from '@/features/coach/roll-call/types';
import { buildRollCallDeckKey } from '@/features/coach/roll-call/types';

export interface RollCallProfileSlice {
  fullName: string | null;
  avatarUrl: string | null;
  beltRank: string | null;
  beltStripes: number;
}

export interface RollCallFacilitySlice {
  presentedBy: string | null;
}

export interface MergeRosterWithMarksInput {
  roster: ClassRosterResponse;
  marksByDeckKey: ReadonlyMap<string, RollCallMemberMark>;
  profilesByUserId: ReadonlyMap<string, RollCallProfileSlice>;
  /** Gym-day `check_ins` rows keyed by linked `userId` (Phase 12). */
  facilityCheckInsByUserId?: ReadonlyMap<string, RollCallFacilitySlice>;
}

function compareDisplayName(a: RollCallDeckMember, b: RollCallDeckMember): number {
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

function visitorToDeckMember(
  visitor: ClassRosterResponse['visitors'][number],
  marksByDeckKey: ReadonlyMap<string, RollCallMemberMark>,
  profilesByUserId: ReadonlyMap<string, RollCallProfileSlice>,
): RollCallDeckMember {
  const deckKey = buildRollCallDeckKey(visitor.userId, visitor.mindbodyClientId);
  const profile = visitor.userId ? profilesByUserId.get(visitor.userId) : undefined;
  const mark = marksByDeckKey.get(deckKey) ?? null;

  return {
    deckKey,
    displayName: profile?.fullName?.trim() || visitor.name,
    avatarUrl: profile?.avatarUrl ?? null,
    beltRank: profile?.beltRank ?? null,
    beltStripes: profile?.beltStripes ?? 0,
    userId: visitor.userId,
    mindbodyClientId: visitor.mindbodyClientId,
    mark,
    isOnApp: visitor.userId !== null,
    isBookedOnRoster: true,
    hasFacilityCheckInToday: visitor.checkedInLocally,
    isWalkIn: mark?.method === 'walk_in',
    isGuest: mark?.status === 'guest',
    presentedBy: mark?.metadata?.presented_by ?? null,
  };
}

function markOnlyToDeckMember(
  deckKey: string,
  mark: RollCallMemberMark,
  profilesByUserId: ReadonlyMap<string, RollCallProfileSlice>,
  existing?: RollCallDeckMember,
): RollCallDeckMember {
  if (existing) {
    return { ...existing, mark };
  }

  const userId = deckKey.startsWith('mb:') ? null : deckKey;
  const mindbodyClientId = deckKey.startsWith('mb:') ? deckKey.slice(3) : '';
  const profile = userId ? profilesByUserId.get(userId) : undefined;

  return {
    deckKey,
    displayName: profile?.fullName?.trim() || 'Member',
    avatarUrl: profile?.avatarUrl ?? null,
    beltRank: profile?.beltRank ?? null,
    beltStripes: profile?.beltStripes ?? 0,
    userId,
    mindbodyClientId,
    mark,
    isOnApp: userId !== null,
    isBookedOnRoster: false,
    hasFacilityCheckInToday: false,
    isWalkIn: mark.method === 'walk_in',
    isGuest: mark.status === 'guest',
    presentedBy: null,
  };
}

function applyFacilityOverlay(
  member: RollCallDeckMember,
  facilityCheckInsByUserId: ReadonlyMap<string, RollCallFacilitySlice> | undefined,
): RollCallDeckMember {
  const facility = member.userId ? facilityCheckInsByUserId?.get(member.userId) : undefined;
  if (!facility && !member.hasFacilityCheckInToday) {
    return member;
  }

  return {
    ...member,
    hasFacilityCheckInToday: member.hasFacilityCheckInToday || Boolean(facility),
    presentedBy: facility?.presentedBy ?? member.presentedBy,
  };
}

/** Marked members always show; unmarked roster rows require a gym-day door check-in. */
export function isEligibleForRollCallDeck(member: RollCallDeckMember): boolean {
  if (member.mark) return true;
  return member.hasFacilityCheckInToday;
}

/**
 * Merge Mindbody roster rows with session marks and linked profile avatars/belts.
 *
 * **Deck eligibility:** unmarked roster rows appear only when the member has a gym-day
 * door check-in (`hasFacilityCheckInToday`). No door check-in = absent unless the coach
 * marks them later (e.g. QR scan). Marked members always remain visible.
 *
 * **Deck order (frozen for UI phases 5–18):**
 * 1. Roster members **without a mark** first, sorted A→Z by display name.
 * 2. Roster members **with a mark** next, sorted A→Z.
 * 3. **Late / walk-in additions** (marked members not on the Mindbody roster) appended last, A→Z.
 *
 * Avatar URL and belt fields resolve from `profilesByUserId` for linked `userId` rows (R1).
 */
export function mergeRosterWithMarks(input: MergeRosterWithMarksInput): RollCallDeckMember[] {
  const { roster, marksByDeckKey, profilesByUserId, facilityCheckInsByUserId } = input;
  const rosterKeys = new Set<string>();

  const rosterMembers = roster.visitors.map((visitor) => {
    const member = visitorToDeckMember(visitor, marksByDeckKey, profilesByUserId);
    rosterKeys.add(member.deckKey);
    return member;
  });

  const unmarked: RollCallDeckMember[] = [];
  const markedOnRoster: RollCallDeckMember[] = [];

  for (const member of rosterMembers) {
    if (member.mark) {
      markedOnRoster.push(member);
    } else {
      unmarked.push(member);
    }
  }

  unmarked.sort(compareDisplayName);
  markedOnRoster.sort(compareDisplayName);

  const additions: RollCallDeckMember[] = [];

  for (const [deckKey, mark] of marksByDeckKey) {
    if (rosterKeys.has(deckKey)) continue;
    additions.push(markOnlyToDeckMember(deckKey, mark, profilesByUserId));
  }

  additions.sort(compareDisplayName);

  return [...unmarked, ...markedOnRoster, ...additions]
    .map((member) => applyFacilityOverlay(member, facilityCheckInsByUserId))
    .filter(isEligibleForRollCallDeck);
}

export function marksMapFromDeckMembers(
  deck: ReadonlyArray<Pick<RollCallDeckMember, 'deckKey' | 'mark'>>,
): Map<string, RollCallMemberMark> {
  const map = new Map<string, RollCallMemberMark>();
  for (const member of deck) {
    if (member.mark) {
      map.set(member.deckKey, member.mark);
    }
  }
  return map;
}
