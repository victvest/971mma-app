import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseConfigError, isSupabaseConfigured } from '@/core/config/env';
import { useAuthStore } from '@/stores/useAuthStore';
import { createSessionFromUrl } from '../services/authDeepLink';
import { supabaseAuthService } from '../services/supabaseAuth';
import { readSecureStoreChunkCount } from '@/lib/secureStorageAdapter';
import { getSupabaseAuthStorageKey } from '@/services/supabase/client';
import type { AuthResult, AuthUser } from '../types';
import { navigateAfterAuthentication } from '@/features/auth/navigation/navigateAfterAuthentication';
import { syncAuthProfileFromSession } from '@/features/auth/services/authProfileSync';
import { PerfMark, perfMarkOnce } from '@/shared/performance';

type AuthContextValue = {
  session: Session | null;
  user: AuthUser | null;
  initializing: boolean;
  configError: string | null;
  completingSignupVerification: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signUpWithGoogle: () => Promise<AuthResult>;
  verifySignupOtp: (email: string, token: string) => Promise<AuthResult>;
  resendSignupOtp: (email: string) => Promise<AuthResult>;
  sendRecoveryOtp: (email: string) => Promise<AuthResult>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<AuthResult>;
  resendRecoveryOtp: (email: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  passwordRecoveryActive: boolean;
  needsOnboarding: boolean;
  completePasswordRecovery: () => void;
  markOnboardingComplete: (patch: { fullName: string; avatarUrl: string | null }) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const [completingSignupVerification, setCompletingSignupVerification] = useState(false);
  const router = useRouter();
  const configError = isSupabaseConfigured() ? null : getSupabaseConfigError();

  useEffect(() => {
    if (configError) {
      setInitializing(false);
      return;
    }

    let mounted = true;

    async function handleDeepLink(url: string | null) {
      if (!url) return;
      const result = await createSessionFromUrl(url);
      if (!mounted) return;

      if (result.error) {
        console.warn('[auth] Deep link session error:', result.error);
        return;
      }

      if (result.recovery) {
        setPasswordRecoveryActive(true);
        router.replace('/(auth)/change-password');
      }
    }

    supabaseAuthService
      .getSession()
      .then(async (next) => {
        if (!mounted) return;
        const restoreStarted = globalThis.performance?.now?.() ?? Date.now();
        let storageChunkCount: number | null = null;

        try {
          storageChunkCount = await readSecureStoreChunkCount(getSupabaseAuthStorageKey());
        } catch {
          storageChunkCount = null;
        }

        setSession(next);
        await syncAuthProfileFromSession(next);
        setInitializing(false);

        perfMarkOnce(PerfMark.authSessionRestored, {
          hasSession: Boolean(next),
          restoreMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - restoreStarted),
          storageChunkCount,
        });
      })
      .catch(() => {
        if (!mounted) return;
        void syncAuthProfileFromSession(null);
        setInitializing(false);
      });

    Linking.getInitialURL().then((url) => handleDeepLink(url));

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    const unsubscribe = supabaseAuthService.onAuthStateChange((next, event) => {
      if (!mounted) return;
      setSession(next);

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryActive(true);
        router.replace('/(auth)/change-password');
        return;
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryActive(false);
      }

      void (async () => {
        await syncAuthProfileFromSession(next);
        if (!mounted) return;

        if (event === 'SIGNED_IN' && next?.user && useAuthStore.getState().isAuthenticated) {
          navigateAfterAuthentication(router.replace);
        }
      })();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabaseAuthService.startAutoRefresh();
      else supabaseAuthService.stopAutoRefresh();
    });

    return () => {
      mounted = false;
      unsubscribe();
      linkSub.remove();
      appStateSub.remove();
    };
  }, [configError, router]);

  const signIn = useCallback(
    (email: string, password: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.signIn(email, password);
    },
    [configError],
  );

  const signUp = useCallback(
    (email: string, password: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.signUp(email, password);
    },
    [configError],
  );

  const signInWithGoogle = useCallback(() => {
    if (configError) return Promise.resolve({ error: configError });
    return supabaseAuthService.signInWithGoogle();
  }, [configError]);

  const signUpWithGoogle = useCallback(() => {
    if (configError) return Promise.resolve({ error: configError });
    return supabaseAuthService.signUpWithGoogle();
  }, [configError]);

  const verifySignupOtp = useCallback(
    async (email: string, token: string) => {
      if (configError) return { error: configError };
      setCompletingSignupVerification(true);
      try {
        const result = await supabaseAuthService.verifySignupOtp(email, token);
        if (result.error) return result;

        const nextSession = await supabaseAuthService.getSession();
        setSession(nextSession);
        await syncAuthProfileFromSession(nextSession);
        return { error: null };
      } finally {
        setCompletingSignupVerification(false);
      }
    },
    [configError],
  );

  const resendSignupOtp = useCallback(
    (email: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.resendSignupOtp(email);
    },
    [configError],
  );

  const sendRecoveryOtp = useCallback(
    (email: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.sendRecoveryOtp(email);
    },
    [configError],
  );

  const verifyRecoveryOtp = useCallback(
    async (email: string, token: string) => {
      if (configError) return { error: configError };
      const result = await supabaseAuthService.verifyRecoveryOtp(email, token);
      if (!result.error) {
        setPasswordRecoveryActive(true);
      }
      return result;
    },
    [configError],
  );

  const resendRecoveryOtp = useCallback(
    (email: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.resendRecoveryOtp(email);
    },
    [configError],
  );

  const resetPassword = useCallback(
    (email: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.sendRecoveryOtp(email);
    },
    [configError],
  );

  const updatePassword = useCallback(
    (password: string) => {
      if (configError) return Promise.resolve({ error: configError });
      return supabaseAuthService.updatePassword(password);
    },
    [configError],
  );

  const signOut = useCallback(async () => {
    setPasswordRecoveryActive(false);
    if (configError) return;
    await supabaseAuthService.signOut();
    setSession(null);
    await syncAuthProfileFromSession(null);
  }, [configError]);

  const completePasswordRecovery = useCallback(() => {
    setPasswordRecoveryActive(false);
  }, []);

  const needsOnboarding = useAuthStore((state) => state.needsOnboarding);

  const markOnboardingComplete = useCallback(
    (patch: { fullName: string; avatarUrl: string | null }) => {
      useAuthStore.getState().markOnboardingComplete(patch);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      configError,
      completingSignupVerification,
      signIn,
      signUp,
      signInWithGoogle,
      signUpWithGoogle,
      verifySignupOtp,
      resendSignupOtp,
      sendRecoveryOtp,
      verifyRecoveryOtp,
      resendRecoveryOtp,
      resetPassword,
      updatePassword,
      signOut,
      passwordRecoveryActive,
      needsOnboarding,
      completePasswordRecovery,
      markOnboardingComplete,
    }),
    [
      session,
      initializing,
      configError,
      completingSignupVerification,
      signIn,
      signUp,
      signInWithGoogle,
      signUpWithGoogle,
      verifySignupOtp,
      resendSignupOtp,
      sendRecoveryOtp,
      verifyRecoveryOtp,
      resendRecoveryOtp,
      resetPassword,
      updatePassword,
      signOut,
      passwordRecoveryActive,
      needsOnboarding,
      completePasswordRecovery,
      markOnboardingComplete,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
