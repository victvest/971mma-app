import { getSupabaseClient } from '@/services/supabase/client';
import type { RedemptionRow, RewardRow } from '@/types/database';
import type { RedemptionItem, RewardItem } from '@/types/domain';
import { mapRedemptionRow, mapRewardRow } from './mappers';

const REWARD_COLUMNS =
  'id, name, category, cost_points, active, unlock_rule, fulfillment, inventory, sort_order, created_at, deleted_at, available_from, available_until';
const REDEMPTION_COLUMNS =
  'id, user_id, reward_id, cost_points, status, fulfilled_at, created_at, rewards_catalog(name, category, fulfillment)';

/** Maximum redemption history rows returned per member. */
export const REDEMPTION_HISTORY_LIMIT = 25;

async function currentUserId(): Promise<string> {
  const { data } = await getSupabaseClient().auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function getCatalog(): Promise<RewardItem[]> {
  const now = new Date().toISOString();
  const client = getSupabaseClient();
  const current = await client
    .from('rewards_catalog')
    .select(REWARD_COLUMNS)
    .eq('active', true)
    .is('deleted_at', null)
    .or(`available_from.is.null,available_from.lte.${now}`)
    .or(`available_until.is.null,available_until.gte.${now}`)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  let rows = current.data as unknown[] | null;
  let error = current.error;

  if (current.error) {
    const fallback = await client
      .from('rewards_catalog')
      .select('id, name, category, cost_points, active, unlock_rule, fulfillment, inventory, sort_order, created_at')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    rows = fallback.data as unknown[] | null;
    error = fallback.error;
  }

  if (error) throw error;
  return ((rows ?? []) as RewardRow[])
    .filter((row) => row.unlock_rule?.placeholder !== true)
    .map(mapRewardRow);
}

export async function getMyRedemptions(userId?: string): Promise<RedemptionItem[]> {
  const resolvedUserId = userId ?? (await currentUserId());
  const { data, error } = await getSupabaseClient()
    .from('redemptions')
    .select(REDEMPTION_COLUMNS)
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false })
    .range(0, REDEMPTION_HISTORY_LIMIT - 1);

  if (error) throw error;
  return ((data ?? []) as RedemptionRow[]).map(mapRedemptionRow);
}

export async function redeem(rewardId: string): Promise<RedemptionItem> {
  const { data, error } = await getSupabaseClient().rpc('redeem_reward', {
    p_reward: rewardId,
  });

  if (error) throw error;
  return mapRedemptionRow(data as RedemptionRow);
}
