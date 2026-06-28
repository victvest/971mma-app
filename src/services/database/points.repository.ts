import { getSupabaseClient } from '@/services/supabase/client';
import type { PointsAccountRow, PointsLedgerRow } from '@/types/database';
import type { PointsAccount, PointsLedgerItem } from '@/types/domain';
import { mapPointsAccountRow, mapPointsLedgerRow } from './mappers';

const POINTS_ACCOUNT_COLUMNS = 'user_id, balance, tier, lifetime_points, updated_at';
const POINTS_LEDGER_COLUMNS =
  'id, user_id, delta, reason, ref_id, ref_table, metadata, balance_after, created_at';
const PAGE_SIZE = 20;

async function currentUserId(): Promise<string> {
  const { data } = await getSupabaseClient().auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function getPointsAccount(userId?: string): Promise<PointsAccount> {
  const resolvedUserId = userId ?? (await currentUserId());
  const client = getSupabaseClient();
  const cacheResult = await client
    .from('points_balance_cache')
    .select(POINTS_ACCOUNT_COLUMNS)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (!cacheResult.error) {
    if (!cacheResult.data) {
      return {
        userId: resolvedUserId,
        balance: 0,
        tier: 'bronze',
        lifetimePoints: 0,
        updatedAt: null,
      };
    }

    return mapPointsAccountRow(cacheResult.data as PointsAccountRow);
  }

  const { data, error } = await client
    .from('points_accounts')
    .select(POINTS_ACCOUNT_COLUMNS)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      userId: resolvedUserId,
      balance: 0,
      tier: 'bronze',
      lifetimePoints: 0,
      updatedAt: null,
    };
  }

  return mapPointsAccountRow(data as PointsAccountRow);
}

export async function getLedgerPage(
  offset: number,
  limit = PAGE_SIZE,
  userId?: string,
): Promise<PointsLedgerItem[]> {
  const resolvedUserId = userId ?? (await currentUserId());
  const { data, error } = await getSupabaseClient()
    .from('points_ledger')
    .select(POINTS_LEDGER_COLUMNS)
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return ((data ?? []) as PointsLedgerRow[]).map(mapPointsLedgerRow);
}
