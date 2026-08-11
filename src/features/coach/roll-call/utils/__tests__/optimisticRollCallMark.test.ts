import {
  applyOptimisticRollCallMark,
  preserveUnsyncedDeckMarks,
  upsertOptimisticRosterMember,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import type { RollCallDeckMember, RollCallState } from '@/features/coach/roll-call/types';
import { DEFAULT_ROLL_CALL_CONFIG } from '@/features/coach/roll-call/types';

const emptyState = (): RollCallState => ({
  session: null,
  classId: 'class-1',
  classTitle: 'BJJ',
  startsAt: new Date().toISOString(),
  deck: [],
  summary: {
    present: 0,
    late: 0,
    absent: 0,
    leftEarly: 0,
    walkIns: 0,
    guests: 0,
    notOnApp: 0,
    sessionCount: 0,
    totalMarked: 0,
    totalOnDeck: 0,
  },
  rosterCachedAt: null,
  config: DEFAULT_ROLL_CALL_CONFIG,
  rosterAttendance: { checkedIn: 0, missing: 0 },
});

function member(
  partial: Partial<RollCallDeckMember> & Pick<RollCallDeckMember, 'deckKey' | 'displayName'>,
): RollCallDeckMember {
  return {
    avatarUrl: null,
    beltRank: null,
    beltStripes: 0,
    userId: partial.deckKey,
    mindbodyClientId: '',
    mark: null,
    isOnApp: true,
    isBookedOnRoster: false,
    hasFacilityCheckInToday: false,
    isWalkIn: false,
    isGuest: false,
    presentedBy: null,
    ...partial,
  };
}

describe('optimistic roll call scan upsert', () => {
  it('inserts a new roster member when confirming a scan', () => {
    const next = upsertOptimisticRosterMember(
      emptyState(),
      {
        userId: 'user-1',
        fullName: 'Ahmed Al Mansoori',
        avatarUrl: null,
        membershipStatus: 'active',
        membershipActive: true,
        mindbodyClientId: 'mb-1',
      },
      {
        id: 'optimistic-1',
        status: 'present',
        method: 'qr_scan',
        markedAt: new Date().toISOString(),
        markedBy: 'coach-1',
        metadata: {},
      },
    );

    expect(next.deck).toHaveLength(1);
    expect(next.deck[0]?.displayName).toBe('Ahmed Al Mansoori');
    expect(next.deck[0]?.mark?.status).toBe('present');
    expect(next.summary.present).toBe(1);
    expect(next.summary.totalOnDeck).toBe(1);
  });

  it('adds a deck row when applying a mark for an unknown member', () => {
    const next = applyOptimisticRollCallMark(
      emptyState(),
      {
        userId: 'user-2',
        mindbodyClientId: null,
        status: 'present',
        method: 'qr_scan',
      },
      'user-2',
      'coach-1',
    );

    expect(next.deck).toHaveLength(1);
    expect(next.deck[0]?.userId).toBe('user-2');
    expect(next.deck[0]?.mark?.status).toBe('present');
  });

  it('keeps local unsynced marks across a server refetch', () => {
    const session = {
      id: 'session-1',
      classId: 'class-1',
      coachId: 'coach-1',
      status: 'in_progress' as const,
      deckCursor: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    const cached: RollCallState = {
      ...emptyState(),
      session,
      deck: [
        member({
          deckKey: 'user-1',
          displayName: 'Ahmed',
          mark: {
            id: 'optimistic-9',
            status: 'present',
            method: 'roll_call',
            markedAt: new Date().toISOString(),
            markedBy: 'coach-1',
            metadata: {},
          },
        }),
      ],
    };

    const fresh: RollCallState = {
      ...emptyState(),
      session,
      deck: [member({ deckKey: 'user-1', displayName: 'Ahmed Al Mansoori', mark: null })],
    };

    const next = preserveUnsyncedDeckMarks(cached, fresh);
    expect(next.deck[0]?.displayName).toBe('Ahmed Al Mansoori');
    expect(next.deck[0]?.mark?.id).toBe('optimistic-9');
    expect(next.deck[0]?.mark?.status).toBe('present');
  });

  it('does not revive marks after discard / new session', () => {
    const cached: RollCallState = {
      ...emptyState(),
      session: {
        id: 'old-session',
        classId: 'class-1',
        coachId: 'coach-1',
        status: 'in_progress',
        deckCursor: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      deck: [
        member({
          deckKey: 'user-1',
          displayName: 'Ahmed',
          mark: {
            id: 'optimistic-9',
            status: 'present',
            method: 'roll_call',
            markedAt: new Date().toISOString(),
            markedBy: 'coach-1',
            metadata: {},
          },
        }),
      ],
    };

    const fresh: RollCallState = {
      ...emptyState(),
      session: {
        id: 'new-session',
        classId: 'class-1',
        coachId: 'coach-1',
        status: 'in_progress',
        deckCursor: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      deck: [member({ deckKey: 'user-1', displayName: 'Ahmed', mark: null })],
    };

    const next = preserveUnsyncedDeckMarks(cached, fresh);
    expect(next.deck[0]?.mark).toBeNull();
    expect(next.session?.id).toBe('new-session');
  });
});
