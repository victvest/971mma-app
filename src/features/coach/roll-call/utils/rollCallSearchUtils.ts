import type { RollCallDeckMember, RollCallSearchResult } from '@/features/coach/roll-call/types';

export function searchResultToDeckMember(result: RollCallSearchResult): RollCallDeckMember {
  return {
    deckKey: result.deckKey,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    beltRank: result.beltRank,
    beltStripes: result.beltStripes,
    userId: result.userId,
    mindbodyClientId: result.mindbodyClientId ?? '',
    mark: null,
    isOnApp: result.isOnApp,
    isBookedOnRoster: false,
    hasFacilityCheckInToday: false,
    isWalkIn: false,
    isGuest: false,
    presentedBy: null,
  };
}

export function searchResultToWalkInMember(result: RollCallSearchResult): RollCallDeckMember {
  return {
    ...searchResultToDeckMember(result),
    isWalkIn: true,
    isGuest: !result.isOnApp || !result.userId,
  };
}

export function prependDeckMember(
  members: RollCallDeckMember[],
  member: RollCallDeckMember,
): RollCallDeckMember[] {
  const existing = members.find((entry) => entry.deckKey === member.deckKey);
  if (existing?.mark) {
    throw new Error('ALREADY_MARKED');
  }

  const without = members.filter((entry) => entry.deckKey !== member.deckKey);
  return [{ ...(existing ?? member), mark: null, isWalkIn: true }, ...without];
}

export function mergeDeckWithServerMembers(
  current: RollCallDeckMember[],
  initialMembers: RollCallDeckMember[],
): RollCallDeckMember[] {
  const serverMap = new Map(initialMembers.map((member) => [member.deckKey, member] as const));
  const localPendingWalkIns = current.filter(
    (member) => member.isWalkIn && member.mark === null && !serverMap.has(member.deckKey),
  );

  if (current.length === 0 && initialMembers.length > 0) {
    return initialMembers;
  }

  if (current.length === 0) {
    return localPendingWalkIns;
  }

  const merged = current.map((member) => {
    const server = serverMap.get(member.deckKey);
    if (!server) return member;

    return {
      ...member,
      displayName: server.displayName,
      avatarUrl: server.avatarUrl,
      beltRank: server.beltRank,
      beltStripes: server.beltStripes,
      mark: server.mark ?? member.mark,
      isOnApp: server.isOnApp,
      isBookedOnRoster: server.isBookedOnRoster,
      isWalkIn:
        member.isWalkIn || server.isWalkIn || server.mark?.method === 'walk_in',
      isGuest: member.isGuest || server.isGuest,
    };
  });

  for (const serverMember of initialMembers) {
    if (!merged.some((member) => member.deckKey === serverMember.deckKey)) {
      merged.push(serverMember);
    }
  }

  const pendingKeys = new Set(localPendingWalkIns.map((member) => member.deckKey));
  const rest = merged.filter((member) => !pendingKeys.has(member.deckKey));
  return [...localPendingWalkIns, ...rest];
}
