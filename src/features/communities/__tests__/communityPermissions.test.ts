import {
  canManageCommunityChannel,
  canPostInCommunityChannel,
  canUseCoachCommunityTools,
} from '@/features/communities/utils/communityPermissions';

describe('communityPermissions', () => {
  it('allows coach owners to manage their channel', () => {
    expect(canManageCommunityChannel('coach', true, false)).toBe(true);
  });

  it('blocks members even when header marks them as owner', () => {
    expect(canManageCommunityChannel('member', true, false)).toBe(false);
  });

  it('blocks coach tools for members and guests', () => {
    expect(canUseCoachCommunityTools('member')).toBe(false);
    expect(canUseCoachCommunityTools('guest')).toBe(false);
  });

  describe('canPostInCommunityChannel', () => {
    it('allows a plain member to post in a group channel', () => {
      expect(canPostInCommunityChannel('group', 'member', false, false)).toBe(true);
    });

    it('allows the coach owner to post in their own group channel', () => {
      expect(canPostInCommunityChannel('group', 'coach', true, false)).toBe(true);
    });

    it('blocks a member from posting in a community (announcement) channel', () => {
      expect(canPostInCommunityChannel('community', 'member', false, false)).toBe(false);
    });

    it('allows the coach owner to post in their community channel', () => {
      expect(canPostInCommunityChannel('community', 'coach', true, false)).toBe(true);
    });

    it('blocks posting for both channel kinds while viewing a child profile', () => {
      expect(canPostInCommunityChannel('group', 'member', false, true)).toBe(false);
      expect(canPostInCommunityChannel('community', 'coach', true, true)).toBe(false);
    });
  });
});
