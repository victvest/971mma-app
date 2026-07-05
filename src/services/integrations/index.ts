import { ACTIVE_MEMBER_PROVIDER } from '@/core/config/integrations';
import { SupabaseProvider } from './supabaseProvider';
import { MindbodyProvider } from './mindbodyProvider';
import type {
  DirectoryProvider,
  IntegrationProvider,
  MemberProvider,
  ProviderSource,
  ScheduleProvider,
} from './types';

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

export function getScheduleProvider(): ScheduleProvider {
  return resolve(ACTIVE_MEMBER_PROVIDER);
}

export function getDirectoryProvider(): DirectoryProvider {
  return resolve(ACTIVE_MEMBER_PROVIDER);
}

export type {
  MemberProvider,
  ScheduleProvider,
  DirectoryProvider,
  IntegrationProvider,
} from './types';
