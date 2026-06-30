import type { BeltRankItem } from '@/types/domain';

export type BeltCurriculumRankKey = 'white' | 'blue' | 'purple' | 'brown' | 'black';

export type BeltCurriculumAscentStop = {
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

const BJJ_BELT_VISUALS: Record<
  BeltCurriculumRankKey,
  Pick<
    BeltCurriculumAscentStop,
    'beltColor' | 'beltBorderColor' | 'stripeColor' | 'nodeColor' | 'nodeBorderColor' | 'summary'
  >
> = {
  white: {
    beltColor: '#FFFFFF',
    beltBorderColor: '#DEDDD9',
    stripeColor: '#FFFFFF',
    nodeColor: '#FFFFFF',
    nodeBorderColor: '#B0AFAA',
    summary: 'Fundamentals, posture, and core positions.',
  },
  blue: {
    beltColor: '#1E4D8C',
    stripeColor: '#FFFFFF',
    nodeColor: '#1E4D8C',
    summary: 'Chain attacks, guard retention, and escapes.',
  },
  purple: {
    beltColor: '#4A154B',
    stripeColor: '#FFFFFF',
    nodeColor: '#4A154B',
    summary: 'Timing, pressure passing, and competition rounds.',
  },
  brown: {
    beltColor: '#6B4226',
    stripeColor: '#FFFFFF',
    nodeColor: '#6B4226',
    summary: 'Advanced strategy, teaching fundamentals, and refinement.',
  },
  black: {
    beltColor: '#0F0F0E',
    stripeColor: '#E8192C',
    nodeColor: '#0F0F0E',
    summary: 'Mastery, mentorship, and academy leadership.',
  },
};

const WRESTLING_LEVEL_VISUALS = [
  {
    beltColor: '#1E4D8C',
    stripeColor: '#FFFFFF',
    nodeColor: '#1E4D8C',
    summary: 'Stance, motion, and mat fundamentals.',
  },
  {
    beltColor: '#4A154B',
    stripeColor: '#FFFFFF',
    nodeColor: '#4A154B',
    summary: 'Takedowns, chain wrestling, and control.',
  },
  {
    beltColor: '#6B4226',
    stripeColor: '#FFFFFF',
    nodeColor: '#6B4226',
    summary: 'Advanced setups, counters, and competition rounds.',
  },
  {
    beltColor: '#0F0F0E',
    stripeColor: '#E8192C',
    nodeColor: '#0F0F0E',
    summary: 'Mastery, leadership, and teaching fundamentals.',
  },
] as const;

function formatRankDisplayName(name: string, discipline: string): string {
  if (discipline === 'bjj' && !/\bbelt\b/i.test(name)) {
    return `${name} Belt`;
  }
  return name;
}

/** Map rank levels from the database into curriculum ascent stops. */
export function mapCurriculumRanksToAscentStops(ranks: BeltRankItem[]): BeltCurriculumAscentStop[] {
  return ranks.map((rank, index) => {
    const rankKey = normalizeBeltRankKey(rank.name);
    const bjjVisual = BJJ_BELT_VISUALS[rankKey];
    const wrestlingVisual = WRESTLING_LEVEL_VISUALS[index % WRESTLING_LEVEL_VISUALS.length];
    const visual = rank.discipline === 'wrestling' ? wrestlingVisual : bjjVisual;

    return {
      id: rank.id,
      rankKey,
      rank: formatRankDisplayName(rank.name, rank.discipline),
      stripes: rank.stripes,
      summary: visual.summary,
      beltColor: visual.beltColor,
      beltBorderColor: 'beltBorderColor' in visual ? visual.beltBorderColor : undefined,
      stripeColor: visual.stripeColor,
      nodeColor: visual.nodeColor,
      nodeBorderColor: 'nodeBorderColor' in visual ? visual.nodeBorderColor : undefined,
    };
  });
}
