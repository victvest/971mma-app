import { getSupabaseClient } from '@/services/supabase/client';

export type AppSettings = {
  showRewardPrices: boolean;
  referralBonusPoints: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  showRewardPrices: true,
  referralBonusPoints: 250,
};

export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await getSupabaseClient().rpc('get_app_settings');
  if (error) {
    // Pre-migration environments fall back to defaults.
    return DEFAULT_SETTINGS;
  }

  const row = (data ?? {}) as {
    showRewardPrices?: boolean;
    referralBonusPoints?: number;
  };

  return {
    showRewardPrices: Boolean(row.showRewardPrices ?? DEFAULT_SETTINGS.showRewardPrices),
    referralBonusPoints: Number(row.referralBonusPoints ?? DEFAULT_SETTINGS.referralBonusPoints),
  };
}
