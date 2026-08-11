import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/services/supabase/client';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { clearGuestMode, isGuestModePersisted } from '@/features/auth/services/guestModeStorage';
import {
  getAuthProfileSyncEpoch,
  invalidateAuthProfileSync,
  nextAuthProfileSyncEpoch,
} from './authProfileSyncEpoch';
import type { UserRole } from '../types';

export { getAuthProfileSyncEpoch, invalidateAuthProfileSync } from './authProfileSyncEpoch';

export type ProfileAuthInfo = {
  full_name: string | null;
  role: UserRole | null;
  onboarding_completed_at: string | null;
  account_status: 'registered' | 'activation_required' | 'active' | 'disabled' | 'deleted' | null;
};

type ProfileAuthReadResult = {
  profile: ProfileAuthInfo | null;
  readFailed: boolean;
};

function normalizeRole(role: unknown): UserRole {
  if (role === 'coach' || role === 'admin') return role;
  return 'member';
}

function readDemoFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

export async function readProfileAuthInfo(userId: string): Promise<ProfileAuthReadResult> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('full_name, role, onboarding_completed_at, account_status')
    .eq('id', userId)
    .maybeSingle<ProfileAuthInfo>();

  if (error) {
    console.warn('[auth] Failed to read profile auth info:', error.message);
    return { profile: null, readFailed: true };
  }

  return { profile: data ?? null, readFailed: false };
}

export function deriveNeedsOnboarding(
  profile: ProfileAuthInfo | null,
  readFailed: boolean,
  currentNeedsOnboarding: boolean,
): boolean {
  if (readFailed) return currentNeedsOnboarding;
  return !profile?.onboarding_completed_at;
}

export async function syncAuthProfileFromSession(session: Session | null): Promise<void> {
  const epoch = nextAuthProfileSyncEpoch();
  const { login, logout, setNeedsOnboarding } = useAuthStore.getState();

  if (!session?.user) {
    useActiveProfileStore.getState().reset();

    const guestPersisted = await isGuestModePersisted();
    if (guestPersisted) {
      useAuthStore.getState().restoreGuestSession();
      return;
    }

    logout();
    return;
  }

  await clearGuestMode();

  const { id, email, user_metadata } = session.user;
  const appMetadata = session.user.app_metadata ?? {};
  const { profile, readFailed } = await readProfileAuthInfo(id);

  if (epoch !== getAuthProfileSyncEpoch()) return;

  login({
    id,
    email: email ?? '',
    fullName: profile?.full_name ?? (user_metadata?.full_name as string | undefined) ?? '',
    role: normalizeRole(profile?.role),
    accountStatus: profile?.account_status ?? 'registered',
    demo: readDemoFlag(appMetadata.demo) || readDemoFlag(user_metadata?.demo),
  });

  if (epoch !== getAuthProfileSyncEpoch()) return;

  setNeedsOnboarding(
    deriveNeedsOnboarding(profile, readFailed, useAuthStore.getState().needsOnboarding),
  );
}

export async function applyProfileAuthInfo(userId: string, email: string): Promise<boolean> {
  invalidateAuthProfileSync();
  const epoch = getAuthProfileSyncEpoch();

  const { profile, readFailed } = await readProfileAuthInfo(userId);
  if (epoch !== getAuthProfileSyncEpoch()) return false;
  if (readFailed || !profile) return false;

  const { login, setNeedsOnboarding } = useAuthStore.getState();
  login({
    id: userId,
    email,
    fullName: profile.full_name ?? '',
    role: normalizeRole(profile.role),
    accountStatus: profile.account_status ?? 'registered',
  });

  if (epoch !== getAuthProfileSyncEpoch()) return false;

  setNeedsOnboarding(!profile.onboarding_completed_at);
  return true;
}
