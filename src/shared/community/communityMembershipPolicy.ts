/** Documents community membership rules after the product group flow migration (0095). */

export type CommunityEligibilitySource =
  | 'discipline'
  | 'class_attendance'
  | 'coach_profile'
  | 'membership_product';

export type CommunityMembershipFixture = {
  userId: string;
  channelId: string;
  source: CommunityEligibilitySource;
  active: boolean;
};

export type CommunityMembershipState = {
  joinedChannelIds: string[];
  coachOwnedChannelIds?: string[];
  hasValidMembership?: boolean;
};

export function applyCommunityMembershipSync(
  current: CommunityMembershipState,
  eligible: CommunityMembershipFixture[],
): { granted: string[]; revoked: string[]; joinedChannelIds: string[] } {
  const coachOwned = new Set(current.coachOwnedChannelIds ?? []);
  const hasValidMembership = current.hasValidMembership ?? true;
  const activeEligibleIds = new Set(
    eligible
      .filter((row) => row.active && row.source === 'coach_profile')
      .map((row) => row.channelId),
  );

  const joined = new Set(current.joinedChannelIds);
  const granted: string[] = [];
  const revoked: string[] = [];

  for (const channelId of activeEligibleIds) {
    if (!joined.has(channelId)) {
      joined.add(channelId);
      granted.push(channelId);
    }
  }

  for (const channelId of joined) {
    if (!hasValidMembership && !coachOwned.has(channelId)) {
      joined.delete(channelId);
      revoked.push(channelId);
    }
  }

  return {
    granted,
    revoked,
    joinedChannelIds: [...joined],
  };
}

export function publicGroupRequiresIntentionalJoin(params: {
  isPublic: boolean;
  hasDisciplineAccess: boolean;
  alreadyJoined: boolean;
}): boolean {
  return params.isPublic && params.hasDisciplineAccess && !params.alreadyJoined;
}

export function membershipRevokedWhenDisciplineEnds(
  hadDisciplineAccess: boolean,
  disciplineStillActive: boolean,
): boolean {
  return hadDisciplineAccess && !disciplineStillActive;
}

export function coachChannelEligibleViaUserId(params: {
  coachUserId: string | null;
  memberUserId: string;
  coachActive: boolean;
}): boolean {
  return (
    params.coachActive &&
    Boolean(params.coachUserId) &&
    params.coachUserId === params.memberUserId
  );
}
