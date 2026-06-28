import { getSupabaseClient } from '@/services/supabase/client';
import { getDisciplineScore } from './discipline.repository';
import type { MilestoneItem, MilestoneStatus } from '@/types/domain';

type MilestoneCatalogRow = {
  id: string;
  name: string;
  description: string | null;
  unlock_days: number;
  category: string | null;
  icon: string | null;
  points_award: number | null;
};

type MemberMilestoneRow = {
  milestone_id: string;
  status: MilestoneStatus;
  earned_at: string | null;
};

type SupabaseLikeClient = ReturnType<typeof getSupabaseClient>;

function deriveStatuses(
  catalog: MilestoneCatalogRow[],
  trainingDays: number,
): Map<string, { status: MilestoneStatus; earnedAt: string | null }> {
  const sorted = [...catalog].sort((a, b) => a.unlock_days - b.unlock_days || a.name.localeCompare(b.name));
  const nextMilestone = sorted.find((item) => trainingDays < item.unlock_days) ?? null;
  const derived = new Map<string, { status: MilestoneStatus; earnedAt: string | null }>();

  for (const item of sorted) {
    if (trainingDays >= item.unlock_days) {
      derived.set(item.id, { status: 'earned', earnedAt: null });
      continue;
    }
    if (nextMilestone?.id === item.id) {
      derived.set(item.id, { status: 'next', earnedAt: null });
      continue;
    }
    derived.set(item.id, { status: 'locked', earnedAt: null });
  }

  return derived;
}

function mapCatalogRow(
  row: MilestoneCatalogRow,
  status: MilestoneStatus,
  earnedAt: string | null,
): MilestoneItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    unlockDays: row.unlock_days,
    category: row.category,
    icon: row.icon,
    pointsAward: row.points_award ?? 0,
    status,
    earnedAt,
  };
}

export async function getMyMilestones(userId?: string): Promise<MilestoneItem[]> {
  const resolvedUserId =
    userId ??
    (await (async () => {
      const { data: userData } = await getSupabaseClient().auth.getUser();
      const id = userData.user?.id;
      if (!id) throw new Error('Not authenticated');
      return id;
    })());

  const client = getSupabaseClient();

  const [catalogResult, memberResult, disciplineScore] = await Promise.all([
    fetchMilestoneCatalog(client),
    client
      .from('member_milestones')
      .select('milestone_id, status, earned_at')
      .eq('user_id', resolvedUserId),
    getDisciplineScore(resolvedUserId),
  ]);

  if (catalogResult.error) throw catalogResult.error;
  if (memberResult.error) throw memberResult.error;

  const catalog = (catalogResult.data ?? []) as MilestoneCatalogRow[];
  const memberRows = (memberResult.data ?? []) as MemberMilestoneRow[];
  const trainingDays = disciplineScore.trainingDays;
  const memberById = new Map(memberRows.map((row) => [row.milestone_id, row]));
  const derivedById = deriveStatuses(catalog, trainingDays);

  return catalog.map((row) => {
    const member = memberById.get(row.id);
    if (member) {
      return mapCatalogRow(row, member.status, member.earned_at);
    }
    const derived = derivedById.get(row.id) ?? { status: 'locked' as const, earnedAt: null };
    return mapCatalogRow(row, derived.status, derived.earnedAt);
  });
}

async function fetchMilestoneCatalog(client: SupabaseLikeClient) {
  const current = await client
    .from('milestones')
    .select('id, name, description, unlock_days, category, icon, points_award, hidden, sort_order')
    .eq('active', true)
    .eq('hidden', false)
    .order('unlock_days', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!current.error) return current;

  return client
    .from('milestones')
    .select('id, name, unlock_days, category, icon')
    .eq('active', true)
    .order('unlock_days', { ascending: true })
    .order('name', { ascending: true });
}
