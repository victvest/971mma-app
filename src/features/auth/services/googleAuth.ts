import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import { getSupabaseClient } from '@/services/supabase/client';
import { createSessionFromUrl } from './authDeepLink';
import { getAuthRedirectUri } from './authRedirect';
import { formatAuthError } from './authValidation';
import type { AuthResult } from '../types';

const GOOGLE_PROVIDER = 'google';
const GOOGLE_AUTH_QUERY_PARAMS = {
  prompt: 'select_account',
} as const;

export function isGoogleAuthCancelled(resultType: WebBrowserAuthSessionResult['type']): boolean {
  return resultType === 'cancel' || resultType === 'dismiss';
}

export async function continueWithGoogle(): Promise<AuthResult> {
  const redirectTo = getAuthRedirectUri();
  const shouldHandleBrowserRedirect = Platform.OS !== 'web';

  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: GOOGLE_PROVIDER,
    options: {
      redirectTo,
      queryParams: GOOGLE_AUTH_QUERY_PARAMS,
      skipBrowserRedirect: shouldHandleBrowserRedirect,
    },
  });

  if (error) {
    return { error: formatAuthError(error) };
  }

  if (Platform.OS === 'web') {
    return { error: null };
  }

  const authUrl = data?.url;
  if (!authUrl) {
    return { error: 'Could not start Google authentication. Please try again.' };
  }

  const browserResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
  if (isGoogleAuthCancelled(browserResult.type)) {
    return { error: null, cancelled: true };
  }

  if (browserResult.type !== 'success' || !('url' in browserResult) || !browserResult.url) {
    return { error: 'Google authentication did not complete. Please try again.' };
  }

  const sessionResult = await createSessionFromUrl(browserResult.url);
  if (sessionResult.error) {
    return { error: formatAuthError(sessionResult.error) };
  }

  return { error: null };
}
