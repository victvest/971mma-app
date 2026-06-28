import type { ImageSourcePropType } from 'react-native';

import {
  academyAssets,
  DISCIPLINE_IMAGE_BY_KEY,
} from '@/features/academy/assets';
import {
  resolveScheduleCategory,
  type ScheduleCategory,
} from '@/features/schedule/utils/scheduleCategory';

const DEFAULT_IMAGE = academyAssets.heroNlbjj;

const CATEGORY_IMAGE: Record<ScheduleCategory, ImageSourcePropType> = {
  bjj: academyAssets.disciplines.bjj,
  wrestling: academyAssets.disciplines.wrestling,
  'muay-thai': academyAssets.disciplines.muayThai,
  mma: academyAssets.disciplines.mma,
  boxing: academyAssets.disciplines.boxing,
  fitness: academyAssets.disciplines.fitness,
};

export function resolveClassImage(
  discipline: string,
  imageUrl: string | null,
  title?: string,
): ImageSourcePropType | { uri: string } {
  if (imageUrl) {
    return { uri: imageUrl };
  }

  if (title) {
    const category = resolveScheduleCategory(title, discipline);
    if (category) return CATEGORY_IMAGE[category];
  }

  const key = discipline.trim().toLowerCase();
  for (const [needle, source] of Object.entries(DISCIPLINE_IMAGE_BY_KEY)) {
    if (key.includes(needle)) {
      return source;
    }
  }

  return DEFAULT_IMAGE;
}
