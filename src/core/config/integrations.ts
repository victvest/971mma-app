

import type { ProviderSource } from '@/services/integrations/types';
import { ENV } from './env';

function resolveProvider(configured: string | undefined, envKey: string): ProviderSource {
  const normalized = configured?.trim().toLowerCase();

  if (!normalized || normalized === 'supabase') {
    return 'supabase';
  }

  const message =
    `SECURITY: EXPO_PUBLIC_${envKey}="${configured}" is not allowed. ` +
    'Direct Mindbody access is disabled — use supabase (Edge Function proxy).';

  if (__DEV__) {
    console.warn(`[integrations] ${message} Falling back to supabase.`);
    return 'supabase';
  }

  throw new Error(message);
}

export const ACTIVE_MEMBER_PROVIDER = resolveProvider(ENV.MEMBER_PROVIDER, 'MEMBER_PROVIDER');

export const ACTIVE_CHECKIN_PROVIDER = resolveProvider(ENV.CHECKIN_PROVIDER, 'CHECKIN_PROVIDER');
