/**
 * Provider resolution. Import `members` / `checkIns` (or the getters) from here
 * in screens — never import Supabase/Mindbody providers directly.
 */
import { ACTIVE_CHECKIN_PROVIDER, ACTIVE_MEMBER_PROVIDER } from '../../config/integrations';
import { SupabaseProvider } from './supabaseProvider';
import { MindbodyProvider } from './mindbodyProvider';
import type { CheckInProvider, IntegrationProvider, MemberProvider, ProviderSource } from './types';

const registry: Record<ProviderSource, () => IntegrationProvider> = {
  supabase: () => new SupabaseProvider(),
  mindbody: () => new MindbodyProvider(),
};

const cache: Partial<Record<ProviderSource, IntegrationProvider>> = {};

function resolve(source: ProviderSource): IntegrationProvider {
  if (!cache[source]) cache[source] = registry[source]();
  return cache[source]!;
}

export function getMemberProvider(): MemberProvider {
  return resolve(ACTIVE_MEMBER_PROVIDER);
}

export function getCheckInProvider(): CheckInProvider {
  return resolve(ACTIVE_CHECKIN_PROVIDER);
}

/** Convenience singletons for screens. */
export const members = getMemberProvider();
export const checkIns = getCheckInProvider();

export type { MemberProvider, CheckInProvider, IntegrationProvider } from './types';
