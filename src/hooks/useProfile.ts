import { useCallback, useEffect, useState } from 'react';
import { members } from '../services/integrations';
import { updateMyProfile } from '../services/db';
import type { MemberProfile, ProfilePatch } from '../types/models';
import { useAuth } from '../context/AuthContext';

/** Mock profile used as a graceful fallback when no row is returned. */
function mockProfile(user: { id?: string; email?: string | null; fullName?: string }): MemberProfile {
  return {
    id: user.id ?? 'mock',
    fullName: user.fullName || user.email?.split('@')[0] || 'Member',
    email: user.email ?? null,
    avatarUrl: null,
    phone: null,
    membershipTier: 'elite',
    membershipStatus: 'active',
    membershipExpiresAt: '2026-07-12T00:00:00Z',
    beltRank: 'White Belt',
    beltStripes: 2,
    source: 'supabase',
  };
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const fallback = mockProfile({
      id: user?.id,
      email: user?.email,
      fullName: (user?.user_metadata as any)?.full_name,
    });
    try {
      const p = await members.getMemberProfile();
      if (p) {
        // Backfill display-only belt defaults if the row hasn't set them yet.
        setProfile({
          ...p,
          beltRank: p.beltRank ?? fallback.beltRank,
          fullName: p.fullName || fallback.fullName,
        });
        setUsingMock(false);
      } else {
        setProfile(fallback);
        setUsingMock(true);
      }
    } catch {
      setProfile(fallback);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (patch: ProfilePatch) => {
      // Optimistic local update.
      setProfile((p) => (p ? { ...p, ...patch } : p));
      if (usingMock) return;
      try {
        const updated = await updateMyProfile(patch);
        setProfile(updated);
      } catch {
        // keep optimistic value; surfaced by caller if needed
      }
    },
    [usingMock],
  );

  return { profile, loading, usingMock, refresh: load, save };
}
