import {
  applyCommunityMembershipSync,
  coachChannelEligibleViaUserId,
  membershipRevokedWhenDisciplineEnds,
  publicGroupRequiresIntentionalJoin,
} from '@/shared/community/communityMembershipPolicy';

describe('community membership product policy', () => {
  const userId = 'user-1';

  it('does not auto-join public groups just because a discipline is eligible', () => {
    const result = applyCommunityMembershipSync(
      { joinedChannelIds: ['channel-a'] },
      [
        { userId, channelId: 'channel-a', source: 'discipline', active: true },
        { userId, channelId: 'channel-b', source: 'class_attendance', active: true },
      ],
    );

    expect(result.granted).toEqual([]);
    expect(result.revoked).toEqual([]);
    expect(result.joinedChannelIds).toEqual(['channel-a']);
  });

  it('grants coach-owned groups through sync for read-state consistency', () => {
    const result = applyCommunityMembershipSync(
      { joinedChannelIds: ['channel-a'], coachOwnedChannelIds: ['channel-b'] },
      [{ userId, channelId: 'channel-b', source: 'coach_profile', active: true }],
    );

    expect(result.granted).toEqual(['channel-b']);
    expect(result.revoked).toEqual([]);
    expect(result.joinedChannelIds).toEqual(['channel-a', 'channel-b']);
  });

  it('revokes non-coach group access when membership is no longer valid', () => {
    const result = applyCommunityMembershipSync(
      {
        joinedChannelIds: ['channel-a', 'channel-b'],
        coachOwnedChannelIds: ['channel-b'],
        hasValidMembership: false,
      },
      [],
    );

    expect(result.granted).toEqual([]);
    expect(result.revoked).toEqual(['channel-a']);
    expect(result.joinedChannelIds).toEqual(['channel-b']);
  });

  it('revokes stale memberships when discipline ends', () => {
    expect(membershipRevokedWhenDisciplineEnds(true, false)).toBe(true);
    expect(membershipRevokedWhenDisciplineEnds(true, true)).toBe(false);
  });

  it('grants coach channels only via linked coach user_id', () => {
    expect(
      coachChannelEligibleViaUserId({
        coachUserId: userId,
        memberUserId: userId,
        coachActive: true,
      }),
    ).toBe(true);

    expect(
      coachChannelEligibleViaUserId({
        coachUserId: 'other-coach',
        memberUserId: userId,
        coachActive: true,
      }),
    ).toBe(false);

    expect(
      coachChannelEligibleViaUserId({
        coachUserId: userId,
        memberUserId: userId,
        coachActive: false,
      }),
    ).toBe(false);
  });

  it('treats public discovery as an invitation to join, not existing access', () => {
    expect(
      publicGroupRequiresIntentionalJoin({
        isPublic: true,
        hasDisciplineAccess: true,
        alreadyJoined: false,
      }),
    ).toBe(true);

    expect(
      publicGroupRequiresIntentionalJoin({
        isPublic: false,
        hasDisciplineAccess: true,
        alreadyJoined: false,
      }),
    ).toBe(false);
  });
});
