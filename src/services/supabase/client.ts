import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, getSupabaseConfigError, isSupabaseConfigured } from '@/core/config/env';
import { secureStorageAdapter } from '@/lib/secureStorageAdapter';

let client: SupabaseClient | null = null;

export function getSupabaseAuthStorageKey(): string {
  const baseUrl = new URL(ENV.SUPABASE_URL);
  return `sb-${baseUrl.hostname.split('.')[0]}-auth-token`;
}

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new Error(getSupabaseConfigError() ?? 'Supabase is not configured.');
    }

    client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: { 'X-Client-Info': '971mma-app' },
      },
    });
  }
  return client;
}

export function resetSupabaseClient(): void {
  client = null;
}
