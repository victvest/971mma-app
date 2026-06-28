import { useEffect } from 'react';
import { Image } from 'expo-image';
import type { CoachItem } from '@/types/domain';

const PREFETCH_LIMIT = 8;

/** Prefetch visible coach headshots after the directory loads. */
export function useCoachDirectoryImagePrefetch(coaches: ReadonlyArray<CoachItem>) {
  const prefetchKey = coaches
    .slice(0, PREFETCH_LIMIT)
    .map((coach) => coach.photoUrl ?? coach.id)
    .join('|');

  useEffect(() => {
    const urls = coaches
      .slice(0, PREFETCH_LIMIT)
      .map((coach) => coach.photoUrl?.trim())
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) return;

    void Image.prefetch(urls, 'memory-disk');
  }, [coaches, prefetchKey]);
}
