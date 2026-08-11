import { useEffect } from 'react';
import { Image } from 'expo-image';
import type { RewardItem } from '@/types/domain';
import { resolveRewardImageUrl } from '@/features/rewards/utils/rewardImages';

/** Prefetch catalog product photos into expo-image memory+disk cache. */
export function useRewardCatalogImagePrefetch(catalog: ReadonlyArray<RewardItem>) {
  const prefetchKey = catalog.map((item) => resolveRewardImageUrl(item) ?? item.id).join('|');

  useEffect(() => {
    const urls = catalog
      .map((item) => resolveRewardImageUrl(item))
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) return;

    void Image.prefetch(urls, 'memory-disk');
  }, [catalog, prefetchKey]);
}
