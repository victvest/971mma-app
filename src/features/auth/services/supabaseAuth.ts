import { getSupabaseClient } from '@/services/supabase/client';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import type { ApiError } from '@/lib/apiError';
import { formatAuthError, normalizeEmail } from './authValidation';
import { continueWithApple } from './appleAuth';
import { continueWithGoogle } from './googleAuth';
import type { AuthService } from '../types';

type AuthSignInResponse = {
  session: {
    access_token: string;
    refresh_token: string;
  };
};

async function signInDirect(email: string, password: string) {
  console.warn('[auth] auth-sign-in edge unavailable — using direct sign-in fallback');
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) {
    return { error: formatAuthError(error) };
  }

  // The primary path (auth-sign-in edge function) refuses admin accounts on the
  // member app. This fallback must enforce the same rule so a network blip can't
  // become an admin-login bypass.
  const userId = data.user?.id;
  if (userId) {
    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>();
    if (profile?.role === 'admin') {
      await client.auth.signOut();
      return { error: formatAuthError({ rawCode: 'INVALID_CREDENTIALS' }) };
    }
  }

  return { error: null };
}

export const supabaseAuthService: AuthService = {
  async getSession() {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session;
  },

  onAuthStateChange(callback) {
    const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      callback(session, event);
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    const normalizedEmail = normalizeEmail(email);

    try {
      const data = await invokeEdge<AuthSignInResponse>('auth-sign-in', {
        email: normalizedEmail,
        password,
      });

      const { error: sessionError } = await getSupabaseClient().auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      return { error: sessionError ? formatAuthError(sessionError) : null };
    } catch (edgeError) {
      const apiError = edgeError as ApiError;
      if (apiError.rawCode) {
        return { error: formatAuthError({ rawCode: apiError.rawCode, message: apiError.message }) };
      }

      try {
        return await signInDirect(email, password);
      } catch (error) {
        return { error: formatAuthError(error) };
      }
    }
  },

  async signUp(email, password) {
    try {
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (error) return { error: formatAuthError(error) };
      if (data.user?.identities?.length === 0) {
        return { error: formatAuthError({ rawCode: 'EMAIL_EXISTS' }) };
      }
      return {
        error: null,
        needsConfirmation: !data.session,
        email: normalizedEmail,
      };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async signInWithGoogle() {
    return continueWithGoogle();
  },

  async signUpWithGoogle() {
    return continueWithGoogle();
  },

  async signInWithApple() {
    return continueWithApple();
  },

  async signUpWithApple() {
    return continueWithApple();
  },

  async verifySignupOtp(email, token) {
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.verifyOtp({
        email: normalizeEmail(email),
        token: token.trim(),
        type: 'signup',
      });
      if (error) return { error: formatAuthError(error) };

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async resendSignupOtp(email) {
    try {
      const { error } = await getSupabaseClient().auth.resend({
        type: 'signup',
        email: normalizeEmail(email),
      });
      return { error: error ? formatAuthError(error) : null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async sendRecoveryOtp(email) {
    try {
      const normalizedEmail = normalizeEmail(email);
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail);
      if (error) return { error: formatAuthError(error) };
      return { error: null, email: normalizedEmail };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async verifyRecoveryOtp(email, token) {
    try {
      const { error } = await getSupabaseClient().auth.verifyOtp({
        email: normalizeEmail(email),
        token: token.trim(),
        type: 'recovery',
      });
      return { error: error ? formatAuthError(error) : null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async resendRecoveryOtp(email) {
    try {
      const normalizedEmail = normalizeEmail(email);
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail);
      return { error: error ? formatAuthError(error) : null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async resetPassword(email) {
    return this.sendRecoveryOtp(email);
  },

  async updatePassword(password) {
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      return { error: error ? formatAuthError(error) : null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  },

  async signOut() {
    await getSupabaseClient().auth.signOut();
  },

  async signOutOtherDevices() {
    try {
      await invokeEdge<{ ok: boolean }>('auth-sign-out-others');
      return { error: null };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        error: apiError.message || 'Unable to sign out other devices.',
      };
    }
  },

  startAutoRefresh() {
    getSupabaseClient().auth.startAutoRefresh();
  },

  stopAutoRefresh() {
    getSupabaseClient().auth.stopAutoRefresh();
  },
};
