import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  buildRollCallSwipeQueue,
  mergeSwipeQueueKeys,
} from '@/features/coach/roll-call/utils/buildRollCallSwipeQueue';

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

describe('buildRollCallSwipeQueue', () => {
  it('only includes unmarked members with facility check-in (or walk-ins)', () => {
    const queue = buildRollCallSwipeQueue([
      member({
        deckKey: 'qr-1',
        displayName: 'QR First',
        mark: {
          id: 'm1',
          status: 'present',
          method: 'qr_scan',
          markedAt: new Date().toISOString(),
          markedBy: 'coach',
          metadata: {},
        },
      }),
      member({
        deckKey: 'checked-in',
        displayName: 'Checked In',
        hasFacilityCheckInToday: true,
      }),
      member({ deckKey: 'not-here', displayName: 'Not Here' }),
      member({
        deckKey: 'swiped',
        displayName: 'Already Swiped',
        hasFacilityCheckInToday: true,
        mark: {
          id: 'm2',
          status: 'absent',
          method: 'roll_call',
          markedAt: new Date().toISOString(),
          markedBy: 'coach',
          metadata: {},
        },
      }),
    ]);

    expect(queue.map((row) => row.deckKey)).toEqual(['checked-in', 'qr-1']);
  });

  it('sorts checked-in unmarked members before walk-ins without check-in', () => {
    const queue = buildRollCallSwipeQueue([
      member({ deckKey: 'walk', displayName: 'Walk In', isWalkIn: true }),
      member({
        deckKey: 'gate',
        displayName: 'Gate In',
        hasFacilityCheckInToday: true,
      }),
    ]);

    expect(queue.map((row) => row.deckKey)).toEqual(['gate', 'walk']);
  });

  it('hides QR members that were already reviewed in the swipe stack', () => {
    const queue = buildRollCallSwipeQueue(
      [
        member({
          deckKey: 'qr-1',
          displayName: 'QR',
          mark: {
            id: 'm1',
            status: 'present',
            method: 'qr_scan',
            markedAt: new Date().toISOString(),
            markedBy: 'coach',
            metadata: {},
          },
        }),
      ],
      new Set(['qr-1']),
    );

    expect(queue).toHaveLength(0);
  });
});

describe('mergeSwipeQueueKeys', () => {
  it('appends new QR members without reshuffling the current pass', () => {
    const unmarked = member({
      deckKey: 'u-1',
      displayName: 'Unmarked',
      hasFacilityCheckInToday: true,
    });
    const qr = member({
      deckKey: 'qr-1',
      displayName: 'QR',
      mark: {
        id: 'm1',
        status: 'present',
        method: 'qr_scan',
        markedAt: new Date().toISOString(),
        markedBy: 'coach',
        metadata: {},
      },
    });

    expect(mergeSwipeQueueKeys(['u-1'], [unmarked, qr])).toEqual(['u-1', 'qr-1']);
  });

  it('drops members who are no longer swipe-eligible', () => {
    const notHere = member({ deckKey: 'u-1', displayName: 'Not Here' });
    const checkedIn = member({
      deckKey: 'u-2',
      displayName: 'Checked In',
      hasFacilityCheckInToday: true,
    });

    expect(mergeSwipeQueueKeys(['u-1'], [notHere, checkedIn])).toEqual(['u-2']);
  });
});
