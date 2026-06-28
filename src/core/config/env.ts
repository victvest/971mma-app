import Constants from 'expo-constants';
import { validateSupabaseEnv, type SupabaseEnvValidation } from './validateSupabaseEnv';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function read(key: string): string {
  return extra[key] || process.env[`EXPO_PUBLIC_${key}`] || '';
}

function readOptional(key: string): string | undefined {
  const value = read(key);
  return value || undefined;
}

const rawUrl = read('SUPABASE_URL');
const rawAnonKey = read('SUPABASE_ANON_KEY');

let cachedValidation: SupabaseEnvValidation | null = null;

function getValidation(): SupabaseEnvValidation {
  if (!cachedValidation) {
    cachedValidation = validateSupabaseEnv(rawUrl, rawAnonKey);
  }
  return cachedValidation;
}

export const ENV = {
  get SUPABASE_URL() {
    const v = getValidation();
    return v.ok ? v.url : '';
  },
  get SUPABASE_ANON_KEY() {
    const v = getValidation();
    return v.ok ? v.anonKey : '';
  },
  MEMBER_PROVIDER: readOptional('MEMBER_PROVIDER'),
  CHECKIN_PROVIDER: readOptional('CHECKIN_PROVIDER'),
  COACH_DEMO_MODE: readOptional('COACH_DEMO_MODE'),
} as const;

export function isSupabaseConfigured(): boolean {
  return getValidation().ok;
}

export function getSupabaseConfigError(): string | null {
  const v = getValidation();
  return v.ok ? null : v.error;
}
