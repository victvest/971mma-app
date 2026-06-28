import { create } from 'zustand';
import type { UserRole } from '@/features/auth/types';
import { invalidateAuthProfileSync } from '@/features/auth/services/authProfileSync';

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountStatus: 'registered' | 'activation_required' | 'active' | 'disabled' | 'deleted';
};

type AuthState = {
  user: AppUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
};

type AuthActions = {
  login: (user: AppUser) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
  setNeedsOnboarding: (needsOnboarding: boolean) => void;
  markOnboardingComplete: (patch: { fullName: string; avatarUrl: string | null }) => void;
  updateUserIdentity: (patch: { fullName?: string }) => void;
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  needsOnboarding: false,

  login: (user) =>
    set({ user, role: user.role, isAuthenticated: true }),

  logout: () =>
    set({ user: null, role: null, isAuthenticated: false, needsOnboarding: false }),

  setRole: (role) =>
    set((state) => ({
      role,
      user: state.user ? { ...state.user, role } : null,
    })),

  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),

  markOnboardingComplete: ({ fullName }) => {
    invalidateAuthProfileSync();
    set((state) => ({
      needsOnboarding: false,
      user: state.user
        ? {
            ...state.user,
            fullName,
          }
        : null,
    }));
  },

  updateUserIdentity: ({ fullName }) =>
    set((state) => ({
      user:
        state.user && fullName !== undefined
          ? { ...state.user, fullName }
          : state.user,
    })),
}));
