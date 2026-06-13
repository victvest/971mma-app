import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Static values live in app.json; here we inject runtime
 * config (Supabase keys) from environment variables into `extra` so secrets are
 * never hardcoded in committed source. Values are read from a gitignored .env
 * (see .env.example).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? '971 MMA',
  slug: config.slug ?? '971-mma-app',
  extra: {
    ...config.extra,
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    MEMBER_PROVIDER: process.env.EXPO_PUBLIC_MEMBER_PROVIDER,
  },
});
