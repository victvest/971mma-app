/**
 * TEMP QA seed — pre-fills every class roll-call list with local dummy members.
 * Delete this file and its call sites when done testing.
 */

import { ROLL_CALL_STITCH_AVATARS } from '@/features/coach/roll-call/fixtures/rollCallStitchAvatars';
import type {
  RecordRollCallMarkRequest,
  RecordRollCallMarkResponse,
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallSessionView,
} from '@/features/coach/roll-call/types';
import type { ClassRosterMemberSlice } from '@/features/coach/roll-call/utils/mergeClassRosterWithMarks';

/** Flip to false or delete this module when QA seed is no longer needed. */
export const ROLL_CALL_LOCAL_TEMP_SEED_ENABLED = false;

export const ROLL_CALL_LOCAL_TEMP_USER_PREFIX = 'local-temp-roll-call-';

type SeedMember = {
  slug: string;
  displayName: string;
  avatarUrl: string;
  beltRank: string;
  beltStripes: number;
  membershipStatus: string;
  membershipActive: boolean;
};

const SEED_MEMBERS: SeedMember[] = [
  {
    slug: '03',
    displayName: 'Omar Hassan',
    avatarUrl: ROLL_CALL_STITCH_AVATARS.omarHassan,
    beltRank: 'White Belt',
    beltStripes: 3,
    membershipStatus: 'Active',
    membershipActive: true,
  },
  {
    slug: '04',
    displayName: 'Layla Ahmed',
    avatarUrl: ROLL_CALL_STITCH_AVATARS.laylaAhmed,
    beltRank: 'Blue Belt',
    beltStripes: 0,
    membershipStatus: 'Expired',
    membershipActive: false,
  },
  {
    slug: '05',
    displayName: 'Marcus Silva',
    avatarUrl: ROLL_CALL_STITCH_AVATARS.marcusSilva,
    beltRank: 'Brown Belt',
    beltStripes: 2,
    membershipStatus: 'Active',
    membershipActive: true,
  },
];

const marksByClass = new Map<string, Map<string, RollCallMemberMark>>();
const removedByClass = new Map<string, Set<string>>();

function seedUserId(slug: string): string {
  return `${ROLL_CALL_LOCAL_TEMP_USER_PREFIX}${slug}`;
}

export function isLocalTempRollCallUser(userId: string | null | undefined): boolean {
  return Boolean(userId?.startsWith(ROLL_CALL_LOCAL_TEMP_USER_PREFIX));
}

function getMarks(classId: string): Map<string, RollCallMemberMark> {
  let marks = marksByClass.get(classId);
  if (!marks) {
    marks = new Map();
    marksByClass.set(classId, marks);
  }
  return marks;
}

function getRemoved(classId: string): Set<string> {
  let removed = removedByClass.get(classId);
  if (!removed) {
    removed = new Set();
    removedByClass.set(classId, removed);
  }
  return removed;
}

export function getLocalTempRollCallRosterMembers(classId: string): ClassRosterMemberSlice[] {
  if (!ROLL_CALL_LOCAL_TEMP_SEED_ENABLED) return [];

  const removed = getRemoved(classId);
  return SEED_MEMBERS.filter((member) => !removed.has(seedUserId(member.slug))).map((member) => {
    const userId = seedUserId(member.slug);
    return {
      userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      membershipStatus: member.membershipStatus,
      membershipActive: member.membershipActive,
      beltRank: member.beltRank,
      beltStripes: member.beltStripes,
      mindbodyClientId: userId,
      addedAt: new Date().toISOString(),
    };
  });
}

/** Append local TEMP members that are not already on the server roster. */
export function mergeLocalTempSeedIntoDeck(
  classId: string,
  deck: RollCallDeckMember[],
): RollCallDeckMember[] {
  if (!ROLL_CALL_LOCAL_TEMP_SEED_ENABLED) return deck;

  const existing = new Set(deck.map((member) => member.userId).filter(Boolean));
  const marks = getMarks(classId);
  const extras: RollCallDeckMember[] = getLocalTempRollCallRosterMembers(classId)
    .filter((member) => !existing.has(member.userId))
    .map((member) => ({
      deckKey: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      beltRank: member.beltRank,
      beltStripes: member.beltStripes,
      userId: member.userId,
      mindbodyClientId: member.mindbodyClientId,
      mark: marks.get(member.userId) ?? null,
      isOnApp: true,
      isBookedOnRoster: false,
      hasFacilityCheckInToday: false,
      isWalkIn: false,
      isGuest: false,
      presentedBy: null,
      membershipStatus: member.membershipStatus,
      membershipActive: member.membershipActive,
    }));

  if (extras.length === 0) return deck;

  const merged = [...deck, ...extras];
  merged.sort((a, b) => {
    const aMarked = a.mark ? 1 : 0;
    const bMarked = b.mark ? 1 : 0;
    if (aMarked !== bMarked) return aMarked - bMarked;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  });
  return merged;
}

export function recordLocalTempRollCallMark(
  input: RecordRollCallMarkRequest,
  session: RollCallSessionView | null,
): RecordRollCallMarkResponse {
  const userId = input.userId;
  if (!userId || !isLocalTempRollCallUser(userId)) {
    throw new Error('Not a local TEMP roll-call member.');
  }

  const mark: RollCallMemberMark = {
    id: `local-temp-mark-${input.classId}-${userId}`,
    status: input.status,
    method: input.method,
    markedAt: new Date().toISOString(),
    markedBy: 'local-temp-coach',
    metadata: input.metadata ?? {},
  };

  getMarks(input.classId).set(userId, mark);

  return {
    mark,
    session: session ?? {
      id: `local-temp-session-${input.classId}`,
      classId: input.classId,
      coachId: 'local-temp-coach',
      status: 'in_progress',
      deckCursor: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
  };
}

export function clearLocalTempRollCallMark(classId: string, deckKey: string): void {
  getMarks(classId).delete(deckKey);
}

/** Discard all in-memory TEMP marks for a class (used when coach discards roll call). */
export function clearLocalTempRollCallClass(classId: string): void {
  marksByClass.delete(classId);
}

export function removeLocalTempRollCallMember(classId: string, userId: string): void {
  getRemoved(classId).add(userId);
  getMarks(classId).delete(userId);
}
