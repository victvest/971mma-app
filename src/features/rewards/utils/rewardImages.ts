import type { ImageSourcePropType } from 'react-native';
import type { RewardCategory, RewardItem } from '@/types/domain';

import rewardGloves from '../../../../assets/images/rewards/reward-gloves.jpg';
import rewardHoodie from '../../../../assets/images/rewards/reward-hoodie.jpg';
import rewardPrivateSession from '../../../../assets/images/rewards/reward-private-session.jpg';
import rewardProteinShake from '../../../../assets/images/rewards/reward-protein-shake.jpg';
import rewardRashguard from '../../../../assets/images/rewards/reward-rashguard.jpg';
import rewardSeminar from '../../../../assets/images/rewards/reward-seminar.jpg';

const CATEGORY_FALLBACKS: Record<RewardCategory, ImageSourcePropType> = {
  gear: rewardRashguard,
  cafeteria: rewardProteinShake,
  coaching: rewardPrivateSession,
  events: rewardSeminar,
};

function matchRewardImage(name: string): ImageSourcePropType | null {
  const normalized = name.toLowerCase();

  if (normalized.includes('hoodie')) return rewardHoodie;
  if (normalized.includes('glove')) return rewardGloves;
  if (normalized.includes('rashguard') || normalized.includes('rash guard')) return rewardRashguard;
  if (normalized.includes('protein') || normalized.includes('shake')) return rewardProteinShake;
  if (normalized.includes('private') || normalized.includes('session')) return rewardPrivateSession;
  if (normalized.includes('seminar')) return rewardSeminar;

  return null;
}

export function resolveRewardImage(item: RewardItem): ImageSourcePropType {
  return matchRewardImage(item.name) ?? CATEGORY_FALLBACKS[item.category] ?? rewardHoodie;
}

export function isLegendaryReward(item: RewardItem): boolean {
  if (item.costPoints >= 1500) return true;

  const requiredTier = item.unlockRule.requiresTier;
  return requiredTier === 'gold';
}
