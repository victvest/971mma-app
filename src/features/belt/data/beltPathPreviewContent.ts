import type { ImageSourcePropType } from 'react-native';

import { academyAssets } from '@/features/academy/assets';
import type { BeltChallengeItem } from '@/features/belt/components/BeltPathChallengeCard';
import type { BeltRequirementItem, PromotionItem } from '@/types/domain';

export type BeltCurriculumRankKey = 'white' | 'blue' | 'purple' | 'brown' | 'black';

/** Preview curriculum ranks — replace with API-driven curriculum when available. */
export type BeltPathCurriculumPreviewItem = {
  id: string;
  rankKey: BeltCurriculumRankKey;
  rank: string;
  stripes: number;
  summary: string;
  beltColor: string;
  beltBorderColor?: string;
  stripeColor?: string;
  nodeColor: string;
  nodeBorderColor?: string;
};

export const BELT_PATH_PREVIEW_CURRICULUM: BeltPathCurriculumPreviewItem[] = [
  {
    id: 'preview-cur-white',
    rankKey: 'white',
    rank: 'White Belt',
    stripes: 4,
    summary: 'Fundamentals, posture, and core positions.',
    beltColor: '#FFFFFF',
    beltBorderColor: '#DEDDD9',
    stripeColor: '#FFFFFF',
    nodeColor: '#FFFFFF',
    nodeBorderColor: '#B0AFAA',
  },
  {
    id: 'preview-cur-blue',
    rankKey: 'blue',
    rank: 'Blue Belt',
    stripes: 4,
    summary: 'Chain attacks, guard retention, and escapes.',
    beltColor: '#1E4D8C',
    stripeColor: '#FFFFFF',
    nodeColor: '#1E4D8C',
  },
  {
    id: 'preview-cur-purple',
    rankKey: 'purple',
    rank: 'Purple Belt',
    stripes: 4,
    summary: 'Timing, pressure passing, and competition rounds.',
    beltColor: '#4A154B',
    stripeColor: '#FFFFFF',
    nodeColor: '#4A154B',
  },
  {
    id: 'preview-cur-brown',
    rankKey: 'brown',
    rank: 'Brown Belt',
    stripes: 4,
    summary: 'Advanced strategy, teaching fundamentals, and refinement.',
    beltColor: '#6B4226',
    stripeColor: '#FFFFFF',
    nodeColor: '#6B4226',
  },
  {
    id: 'preview-cur-black',
    rankKey: 'black',
    rank: 'Black Belt',
    stripes: 4,
    summary: 'Mastery, mentorship, and academy leadership.',
    beltColor: '#0F0F0E',
    stripeColor: '#E8192C',
    nodeColor: '#0F0F0E',
  },
];

/** Preview stripe requirements — replace when curriculum sync is live. */
export const BELT_PATH_PREVIEW_REQUIREMENTS: BeltRequirementItem[] = [
  {
    id: 'preview-req-1',
    rankId: 'preview-white',
    stripe: 1,
    title: '12 Classes',
    description: 'Build consistency on the mat this stripe.',
    type: 'attendance',
    attendanceTarget: 12,
    unlockAfterStripe: null,
    status: 'now',
    assessedAt: null,
  },
  {
    id: 'preview-req-2',
    rankId: 'preview-white',
    stripe: 1,
    title: 'Break fall & bridge',
    description: 'Safe falling and recovering from bottom.',
    type: 'skill',
    attendanceTarget: null,
    unlockAfterStripe: null,
    status: 'locked',
    assessedAt: null,
  },
  {
    id: 'preview-req-3',
    rankId: 'preview-white',
    stripe: 1,
    title: 'Coach Assessment',
    description: 'Closed guard, mount, and side control control.',
    type: 'assessment',
    attendanceTarget: null,
    unlockAfterStripe: null,
    status: 'locked',
    assessedAt: null,
  },
];

/** Preview academy challenges — replace when challenges API is live. */
export const BELT_PATH_PREVIEW_CHALLENGES: BeltChallengeItem[] = [
  {
    id: 'preview-challenge-consistency',
    title: '30-Day Consistency',
    subtitle: 'Train 12 times this month',
    progressLabel: 'Progress: 8/12 sessions',
    status: 'joined',
    imageSource: academyAssets.disciplines.bjj as ImageSourcePropType,
  },
  {
    id: 'preview-challenge-open-mat',
    title: 'Open Mat Warrior',
    subtitle: 'Attend 4 open mat sessions',
    status: 'completed',
    imageSource: academyAssets.disciplines.mma as ImageSourcePropType,
  },
  {
    id: 'preview-challenge-competition',
    title: 'Competition Prep',
    subtitle: 'Unlocks at blue belt',
    status: 'locked',
    imageSource: academyAssets.nextLevelBjj as ImageSourcePropType,
  },
];

/** Preview promotion history — replace with member promotion records. */
export const BELT_PATH_PREVIEW_PROMOTIONS: PromotionItem[] = [
  {
    id: 'preview-promo-enroll',
    discipline: 'bjj',
    fromRankName: null,
    toRankName: 'White Belt',
    fromStripe: null,
    toStripe: 0,
    awardedAt: '2024-09-01T10:00:00.000Z',
  },
];

export function normalizeBeltRankKey(rankName: string | null | undefined): BeltCurriculumRankKey {
  const normalized = (rankName ?? 'white').toLowerCase().replace(/\s+belt$/i, '').trim();

  if (
    normalized === 'white' ||
    normalized === 'blue' ||
    normalized === 'purple' ||
    normalized === 'brown' ||
    normalized === 'black'
  ) {
    return normalized;
  }

  return 'white';
}
