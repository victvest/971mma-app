import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/services/supabase/client';

export type AuthDeepLinkResult = {
  error: string | null;
  recovery: boolean;
};

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

function appendUrlParams(params: URLSearchParams, paramString: string): void {
  new URLSearchParams(paramString).forEach((value, key) => {
    params.set(key, value);
  });
}

function parseUrlParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const params = new URLSearchParams();

  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : url.length;
    appendUrlParams(params, url.slice(queryIndex + 1, queryEnd));
  }

  if (hashIndex >= 0) {
    appendUrlParams(params, url.slice(hashIndex + 1));
  }

  return Object.fromEntries(params);
}

function getEmailOtpType(type: string | undefined): EmailOtpType {
  return type && EMAIL_OTP_TYPES.some((candidate) => candidate === type) ? type : 'email';
}

export async function createSessionFromUrl(url: string): Promise<AuthDeepLinkResult> {
  const params = parseUrlParams(url);
  const isRecovery = params.type === 'recovery';

  if (params.error_description) return { error: params.error_description, recovery: isRecovery };
  if (params.error) return { error: params.error, recovery: isRecovery };

  const client = getSupabaseClient();

  if (params.access_token && params.refresh_token) {
    const { error } = await client.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error?.message ?? null, recovery: isRecovery };
  }

  if (params.code) {
    const { data, error } = await client.auth.exchangeCodeForSession(params.code);
    const redirectType = 'redirectType' in data ? data.redirectType : null;
    return {
      error: error?.message ?? null,
      recovery: isRecovery || redirectType === 'recovery',
    };
  }

  if (params.token_hash) {
    const type = getEmailOtpType(params.type);
    const { error } = await client.auth.verifyOtp({
      token_hash: params.token_hash,
      type,
    });
    return { error: error?.message ?? null, recovery: type === 'recovery' };
  }

  return { error: null, recovery: isRecovery };
}
