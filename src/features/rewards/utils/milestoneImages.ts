import type { ImageSourcePropType } from 'react-native';
import type { MilestoneItem } from '@/types/domain';

import milestoneGi from '../../../../assets/images/milestones/milestone-gi.jpg';
import milestoneGloves from '../../../../assets/images/milestones/milestone-gloves.jpg';
import milestoneRecovery from '../../../../assets/images/milestones/milestone-recovery.jpg';
import milestoneTshirt from '../../../../assets/images/milestones/milestone-tshirt.jpg';

function matchMilestoneImage(name: string): ImageSourcePropType | null {
  const normalized = name.toLowerCase();

  if (normalized.includes('t-shirt') || normalized.includes('shirt')) return milestoneTshirt;
  if (normalized.includes('recovery')) return milestoneRecovery;
  if (normalized.includes('glove')) return milestoneGloves;
  if (normalized.includes('gi')) return milestoneGi;

  return null;
}

export function resolveMilestoneImage(item: MilestoneItem): ImageSourcePropType {
  return matchMilestoneImage(item.name) ?? milestoneTshirt;
}
