import {
  countPromotionReviewCandidates,
  resolveCoachPromotionDisciplines,
} from '@/services/database/coach.repository';
import type { PromotionCandidateItem } from '@/types/domain';

function candidate(
  candidateReason: PromotionCandidateItem['candidateReason'],
): PromotionCandidateItem {
  return {
    userId: `user-${candidateReason}`,
    fullName: 'Member',
    email: 'member@example.com',
    avatarUrl: null,
    beltRank: 'White',
    beltStripes: 0,
    percent: 0,
    trainingDays: 0,
    recentCheckIns: 0,
    candidateReason,
  };
}

describe('coach dashboard promotion disciplines', () => {
  it('uses assigned rank disciplines for promotion queue counts', () => {
    expect(
      resolveCoachPromotionDisciplines([
        { slug: 'muay-thai', hasRankProgression: false },
        { slug: 'wrestling', hasRankProgression: true },
      ]),
    ).toEqual(['wrestling']);
  });

  it('falls back to bjj for legacy coaches without rank discipline assignments', () => {
    expect(resolveCoachPromotionDisciplines([])).toEqual(['bjj']);
  });

  it('counts review candidates across disciplines and excludes tracking-only rows', () => {
    expect(
      countPromotionReviewCandidates([
        [candidate('ready_for_stripe'), candidate('tracking')],
        [candidate('near_ready')],
      ]),
    ).toBe(2);
  });
});
