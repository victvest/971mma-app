/**
 * Integration switchboard.
 *
 * Flip the active provider here (or via env) when Mindbody is ready. Nothing
 * else in the app needs to change — screens talk to the provider interface
 * resolved in `src/services/integrations`.
 */
import type { ProviderSource } from '../services/integrations/types';

/**
 * Which backend powers member identity + profiles.
 * Today: 'supabase'. Later, set to 'mindbody' (or EXPO_PUBLIC_MEMBER_PROVIDER).
 */
export const ACTIVE_MEMBER_PROVIDER: ProviderSource =
  (process.env.EXPO_PUBLIC_MEMBER_PROVIDER as ProviderSource) || 'supabase';

/** Which backend records check-ins. Usually matches the member provider. */
export const ACTIVE_CHECKIN_PROVIDER: ProviderSource =
  (process.env.EXPO_PUBLIC_CHECKIN_PROVIDER as ProviderSource) || 'supabase';

/**
 * Mindbody Public API v6 config — placeholders only, NEVER commit real keys.
 * Populate via .env (EXPO_PUBLIC_MINDBODY_*) when integrating.
 *
 * Required later:
 *   - baseUrl : Mindbody Public API base (v6)
 *   - apiKey  : Mindbody API key (Authorization)
 *   - siteId  : SiteId header identifying the gym location
 *   - staff/user token : obtained via the Auth/UserToken endpoint at runtime
 */
export const mindbodyConfig = {
  baseUrl: process.env.EXPO_PUBLIC_MINDBODY_BASE_URL || 'https://api.mindbodyonline.com/public/v6',
  apiKey: process.env.EXPO_PUBLIC_MINDBODY_API_KEY || '',
  siteId: process.env.EXPO_PUBLIC_MINDBODY_SITE_ID || '',
};

export function isMindbodyConfigured(): boolean {
  return Boolean(mindbodyConfig.apiKey && mindbodyConfig.siteId);
}
