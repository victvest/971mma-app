import type { RollCallMemberMark } from '../../types';
import {
  mergeClassRosterWithMarks,
  type ClassRosterMemberSlice,
} from '../mergeClassRosterWithMarks';

const baseMember = (overrides: Partial<ClassRosterMemberSlice> = {}): ClassRosterMemberSlice => ({
  userId: 'user-1',
  displayName: 'Alice',
  avatarUrl: null,
  membershipStatus: 'active',
  membershipActive: true,
  beltRank: 'blue',
  beltStripes: 2,
  mindbodyClientId: 'mb-1',
  addedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const baseMark = (overrides: Partial<RollCallMemberMark> = {}): RollCallMemberMark => ({
  id: 'mark-1',
  status: 'present',
  method: 'roll_call',
  markedAt: '2026-01-01T00:00:00Z',
  markedBy: 'coach-1',
  metadata: {},
  ...overrides,
});

describe('mergeClassRosterWithMarks', () => {
  it('returns empty deck for empty roster', () => {
    expect(mergeClassRosterWithMarks({ rosterMembers: [], marksByUserId: new Map() })).toEqual([]);
  });

  it('merges roster members with marks', () => {
    const marks = new Map([['user-1', baseMark()]]);
    const deck = mergeClassRosterWithMarks({
      rosterMembers: [baseMember()],
      marksByUserId: marks,
    });

    expect(deck).toHaveLength(1);
    expect(deck[0].mark?.status).toBe('present');
    expect(deck[0].deckKey).toBe('user-1');
  });

  it('sorts unmarked members before marked members', () => {
    const deck = mergeClassRosterWithMarks({
      rosterMembers: [
        baseMember({ userId: 'marked', displayName: 'Zara' }),
        baseMember({ userId: 'unmarked', displayName: 'Aaron' }),
      ],
      marksByUserId: new Map([['marked', baseMark({ id: 'm2' })]]),
    });

    expect(deck[0].userId).toBe('unmarked');
    expect(deck[1].userId).toBe('marked');
  });

  it('sorts QR-scanned members after other marked members', () => {
    const deck = mergeClassRosterWithMarks({
      rosterMembers: [
        baseMember({ userId: 'qr', displayName: 'Quinn' }),
        baseMember({ userId: 'swiped', displayName: 'Sam' }),
        baseMember({ userId: 'open', displayName: 'Alex' }),
      ],
      marksByUserId: new Map([
        ['qr', baseMark({ id: 'm-qr', method: 'qr_scan' })],
        ['swiped', baseMark({ id: 'm-swiped', method: 'roll_call' })],
      ]),
    });

    expect(deck.map((row) => row.userId)).toEqual(['open', 'swiped', 'qr']);
  });

  it('preserves membership fields on deck members', () => {
    const deck = mergeClassRosterWithMarks({
      rosterMembers: [baseMember({ membershipStatus: 'expired', membershipActive: false })],
      marksByUserId: new Map(),
    });

    expect(deck[0].membershipStatus).toBe('expired');
    expect(deck[0].membershipActive).toBe(false);
  });
});
