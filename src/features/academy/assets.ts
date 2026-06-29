/**
 * Official marketing assets sourced from https://971mma.com/ (CloudFront CDN).
 * Re-download only with academy permission; bundled for offline app use.
 *
 * Card/hero variants live in `assets/images/optimized/` — target display size + 3× DPI margin.
 */
import type { ImageSourcePropType } from 'react-native';

import logoOfficial from '../../../assets/brand/971-logo-official.webp';
import heroNlbjj from '../../../assets/images/optimized/hero-nlbjj-card.jpg';
import coachFallbackHero from '../../../assets/images/optimized/coach-fallback-hero.jpg';
import nextLevelBjj from '../../../assets/images/optimized/next-level-bjj-card.jpg';
import academyMasterart from '../../../assets/images/optimized/academy-masterart-card.jpg';
import academyTeam from '../../../assets/images/optimized/academy-team-card.jpg';
import disciplineBjj from '../../../assets/images/optimized/discipline-bjj-card.jpg';
import disciplineMuayThai from '../../../assets/images/optimized/discipline-muaythai-card.jpg';
import disciplineBoxing from '../../../assets/images/optimized/discipline-boxing-card.jpg';
import disciplineYoga from '../../../assets/images/optimized/discipline-yoga-card.jpg';
import disciplineFitness from '../../../assets/images/optimized/discipline-fitness-card.jpg';
import disciplineYouth from '../../../assets/images/optimized/discipline-youth-card.jpg';

export const academyAssets = {
  logoOfficial,
  heroNlbjj,
  /** Client-favorite coach hero — home carousel (member + coach). */
  homeCarouselHero: coachFallbackHero,
  coachFallbackHero,
  nextLevelBjj,
  academyMasterart,
  academyTeam,
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
