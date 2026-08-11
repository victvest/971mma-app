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
  const localByKey = new Map(current.map((member) => [member.deckKey, member] as const));
  const localPendingWalkIns = current.filter(
    (member) => member.isWalkIn && member.mark === null && !serverMap.has(member.deckKey),
  );

  // Server roster is membership source of truth so removals drop from the deck.
  // Keep local optimistic marks when the server mark has not caught up yet.
  const merged = initialMembers.map((server) => {
    const local = localByKey.get(server.deckKey);
    if (!local) return server;

    return {
      ...server,
      mark: server.mark ?? local.mark,
      isWalkIn: local.isWalkIn || server.isWalkIn || server.mark?.method === 'walk_in',
      isGuest: local.isGuest || server.isGuest,
    };
  });

  const pendingKeys = new Set(localPendingWalkIns.map((member) => member.deckKey));
  const rest = merged.filter((member) => !pendingKeys.has(member.deckKey));
  return [...localPendingWalkIns, ...rest];
}
