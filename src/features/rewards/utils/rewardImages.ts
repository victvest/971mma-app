import type { RewardItem } from '@/types/domain';

/** Network image URL from catalog — no local asset fallbacks. */
export function resolveRewardImageUrl(item: RewardItem): string | null {
  const url = item.imageUrl?.trim();
  return url ? url : null;
}

export function isLegendaryReward(item: RewardItem): boolean {
  if (item.costPoints >= 1500) return true;

  const requiredTier = item.unlockRule.requiresTier;
  return requiredTier === 'gold';
}
