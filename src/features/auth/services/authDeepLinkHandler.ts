import type { Href } from 'expo-router';
import { authToast } from '@/shared/components/Toast';
import { navigateAfterAuthentication } from '@/features/auth/navigation/navigateAfterAuthentication';
import { createSessionFromUrl } from './authDeepLink';
import { formatAuthError } from './authValidation';
import { isAuthCallbackUrl } from './authRedirect';
import { syncAuthProfileFromSession } from './authProfileSync';
import { completeSignupActivation } from './postSignupActivation';
import { supabaseAuthService } from './supabaseAuth';

export type AuthDeepLinkOutcome =
  | { kind: 'recovery' }
  | { kind: 'signed_in'; isOAuth: boolean }
  | { kind: 'error'; message: string; recovery: boolean }
  | { kind: 'noop' };

let processingUrl: string | null = null;

function isOAuthSession(user: { app_metadata?: Record<string, unknown> }): boolean {
  const provider = user.app_metadata?.provider;
  return provider === 'google';
}

export async function handleAuthDeepLink(url: string): Promise<AuthDeepLinkOutcome> {
  if (!isAuthCallbackUrl(url)) return { kind: 'noop' };
  if (processingUrl === url) return { kind: 'noop' };

  processingUrl = url;
  try {
    const result = await createSessionFromUrl(url);
    if (result.error) {
      return {
        kind: 'error',
        message: formatAuthError(result.error),
        recovery: result.recovery,
      };
    }

    if (result.recovery) {
      return { kind: 'recovery' };
    }

    const session = await supabaseAuthService.getSession();
    if (!session?.user) {
      return { kind: 'noop' };
    }

    await syncAuthProfileFromSession(session);

    const isOAuth = isOAuthSession(session.user);
    if (isOAuth) {
      await completeSignupActivation(session.user.id, session.user.email ?? '');
    }

    return { kind: 'signed_in', isOAuth };
  } finally {
    if (processingUrl === url) {
      processingUrl = null;
    }
  }
}

export async function routeAuthDeepLinkOutcome(
  outcome: AuthDeepLinkOutcome,
  replace: (href: Href) => void,
  onRecovery?: () => void,
): Promise<void> {
  switch (outcome.kind) {
    case 'recovery':
      onRecovery?.();
      replace('/(auth)/change-password');
      return;
    case 'signed_in':
      navigateAfterAuthentication(replace);
      return;
    case 'error':
      authToast.error(
        outcome.recovery ? 'Password Reset Failed' : 'Authentication Failed',
        outcome.message,
      );
      replace(outcome.recovery ? '/(auth)/forgot-password' : '/(auth)/login');
      return;
    case 'noop':
      replace('/(auth)');
  }
}
