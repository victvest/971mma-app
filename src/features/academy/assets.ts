/**
 * Official academy photography (client shoot) + brand marks.
 * Display variants live in `assets/images/optimized/` — target display size + 3× DPI margin.
 * Raw masters stay in `assets/academy/source/` (gitignored); regenerate with
 * `node scripts/optimize-bundled-images.mjs`.
 */
import type { ImageSourcePropType } from 'react-native';

import logoOfficial from '../../../assets/brand/971-logo-official.webp';
import heroNlbjj from '../../../assets/images/optimized/hero-nlbjj-card.jpg';
import gymUsageHeroInstructor from '../../../assets/images/optimized/gym-usage-hero-instructor.jpg';
import homeFacilityHero from '../../../assets/images/optimized/home-facility-hero.jpg';
import coachFallbackHero from '../../../assets/images/optimized/coach-fallback-hero.jpg';
import nextLevelBjj from '../../../assets/images/optimized/next-level-bjj-card.jpg';
import academyMasterart from '../../../assets/images/optimized/academy-masterart-card.jpg';
import academyTeam from '../../../assets/images/optimized/academy-team-card.jpg';
import academyCoachesCage from '../../../assets/images/optimized/academy-coaches-cage.jpg';
import academyCoachesNlbjj from '../../../assets/images/optimized/academy-coaches-nlbjj.jpg';
import disciplineBjj from '../../../assets/images/optimized/discipline-bjj-card.jpg';
import disciplineMuayThai from '../../../assets/images/optimized/discipline-muaythai-card.jpg';
import disciplineBoxing from '../../../assets/images/optimized/discipline-boxing-card.jpg';
import disciplineYoga from '../../../assets/images/optimized/discipline-yoga-card.jpg';
import disciplineFitness from '../../../assets/images/optimized/discipline-fitness-card.jpg';
import disciplineYouth from '../../../assets/images/optimized/discipline-youth-card.jpg';

export const academyAssets = {
  logoOfficial,
  /** Class default / NLBJJ instructor teaching. */
  heroNlbjj,
  /**
   * Known instructor demo — home “Gym Usage” featured card only.
   * Do not reuse on schedule/about/other classes.
   */
  gymUsageHero: gymUsageHeroInstructor,
  /** NLBJJ gym floor — coach “now teaching” / facility fallback. */
  homeCarouselHero: homeFacilityHero,
  homeFacilityHero,
  coachFallbackHero,
  /** NLBJJ gym floor + wall branding — lineage featured card. */
  nextLevelBjj,
  /** Full BJJ class community (US/Brazil flags) — About philosophy. */
  academyMasterart,
  /** Team in the cage with UAE flag — About community hero. */
  academyTeam,
  /** Coaching staff lineup (cage). */
  academyCoachesCage,
  /** Coaching staff lineup (NLBJJ wall). */
  academyCoachesNlbjj,
  disciplines: {
    bjj: disciplineBjj,
    muayThai: disciplineMuayThai,
    boxing: disciplineBoxing,
    yoga: disciplineYoga,
    fitness: disciplineFitness,
    youth: disciplineYouth,
    mma: academyMasterart,
    wrestling: disciplineFitness,
  },
} as const;

export const DISCIPLINE_IMAGE_BY_KEY: Record<string, ImageSourcePropType> = {
  bjj: disciplineBjj,
  'brazilian jiu-jitsu': disciplineBjj,
  'jiu-jitsu': disciplineBjj,
  'jiu jitsu': disciplineBjj,
  'next level': disciplineBjj,
  boxing: disciplineBoxing,
  mma: academyMasterart,
  'mixed martial arts': academyMasterart,
  'muay thai': disciplineMuayThai,
  wrestling: disciplineFitness,
  freestyle: disciplineFitness,
  yoga: disciplineYoga,
  mobility: disciplineYoga,
  fitness: disciplineFitness,
  performance: disciplineFitness,
  conditioning: disciplineFitness,
  youth: disciplineYouth,
  kids: disciplineYouth,
  teen: disciplineYouth,
  personal: disciplineFitness,
};
