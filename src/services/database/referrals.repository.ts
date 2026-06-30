import { getSupabaseClient } from '@/services/supabase/client';
import type { ReferralItem, ReferralStatus } from '@/types/domain';

type ReferralRow = {
  id: string;
  referred_user_id: string | null;
  referred_name: string | null;
  status: ReferralStatus;
  points_awarded_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReferralStatusRow = {
  applied: boolean;
  status: ReferralStatus | null;
  referrerName: string | null;
};

function mapReferralRow(row: ReferralRow): ReferralItem {
  return {
    id: row.id,
    referredUserId: row.referred_user_id,
    referredDisplayName: row.referred_name,
    status: row.status,
    pointsAwardedAt: row.points_awarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyReferralCode(): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('get_my_referral_code');
  if (error) throw error;
  return String(data ?? '');
}

export async function getMyReferrals(): Promise<ReferralItem[]> {
  const { data, error } = await getSupabaseClient().rpc('get_my_referrals');
  if (error) throw error;
  return ((data ?? []) as ReferralRow[]).map(mapReferralRow);
}

export async function getMyReferralStatus(): Promise<{
  applied: boolean;
  status: ReferralStatus | null;
  referrerName: string | null;
}> {
  const { data, error } = await getSupabaseClient().rpc('get_my_referral_status');
  if (error) throw error;
  const row = (data ?? { applied: false, status: null, referrerName: null }) as ReferralStatusRow;
  return {
    applied: Boolean(row.applied),
    status: row.status,
    referrerName: row.referrerName,
  };
}

export async function applyReferralCode(code: string): Promise<ReferralItem> {
  const { data, error } = await getSupabaseClient().rpc('apply_referral_code', {
    p_code: code.trim(),
  });
  if (error) throw error;

  const row = data as {
    id: string;
    referred_user_id: string | null;
    status: ReferralStatus;
    points_awarded_at: string | null;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    referredUserId: row.referred_user_id,
    referredDisplayName: null,
    status: row.status,
    pointsAwardedAt: row.points_awarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const REFERRAL_BONUS_POINTS = 250;
