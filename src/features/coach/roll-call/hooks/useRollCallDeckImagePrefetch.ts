import { useEffect } from 'react';
import { Image } from 'expo-image';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';

const PREFETCH_AHEAD = 3;

export function useRollCallDeckImagePrefetch(unmarkedMembers: ReadonlyArray<RollCallDeckMember>) {
  const prefetchKey = unmarkedMembers
    .slice(0, PREFETCH_AHEAD)
    .map((member) => member.avatarUrl ?? member.deckKey)
    .join('|');

  useEffect(() => {
    const urls = unmarkedMembers
      .slice(0, PREFETCH_AHEAD)
      .map((member) => resolveRollCallMemberAvatar(member))
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) return;

    void Image.prefetch(urls, 'memory-disk');
  }, [prefetchKey, unmarkedMembers]);
}
