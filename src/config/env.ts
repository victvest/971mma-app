import Constants from 'expo-constants';

/**
 * Central env/config access.
 *
 * Values are read (in priority order) from:
 *   1. Expo config `extra` (populated by app.config.ts from .env at build time)
 *   2. EXPO_PUBLIC_* process env (inlined by the Expo bundler)
 *   3. Public fallback constants below
 *
 * The Supabase anon key is the *public* client key (safe to ship in a mobile
 * app — row-level security enforces access). It is kept here only as a
 * last-resort fallback so a fresh clone still boots without a .env; the real
 * source of truth is `.env` (gitignored) + `.env.example`.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function read(key: string, fallback: string): string {
  return extra[key] || process.env[`EXPO_PUBLIC_${key}`] || fallback;
}

// Public fallback (anon key is publishable; protected by RLS).
const FALLBACK_SUPABASE_URL = 'https://nzbbpduwahcncyvyjusj.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YmJwZHV3YWhjbmN5dnlqdXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg0NTAsImV4cCI6MjA5NjU3NDQ1MH0.YiCfEcagilooR0mWvyinyZSxiRC_rmpKyX9NWkOjjq8';

export const ENV = {
  SUPABASE_URL: read('SUPABASE_URL', FALLBACK_SUPABASE_URL),
  SUPABASE_ANON_KEY: read('SUPABASE_ANON_KEY', FALLBACK_SUPABASE_ANON_KEY),
};
