import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ENV } from '@/core/config/env';
import { probeInternetConnectivity } from '@/core/connectivity/probeInternetConnectivity';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import { getSupabaseClient } from '@/services/supabase/client';
import { createSessionFromUrl } from './authDeepLink';
import { getAuthRedirectUri } from './authRedirect';
import { formatAuthError } from './authValidation';
import { syncAuthProfileFromSession } from './authProfileSync';
import { completeSignupActivation } from './postSignupActivation';
import {
  formatGoogleNativeError,
  isGoogleBrowserAuthCancelled,
  isNativeModuleErrorWithCode,
} from './googleAuthHelpers';
import type { AuthResult } from '../types';

export {
  formatGoogleNativeError,
  googleIosUrlSchemeFromClientId,
  isGoogleBrowserAuthCancelled,
} from './googleAuthHelpers';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

const GOOGLE_PROVIDER = 'google';
const GOOGLE_AUTH_QUERY_PARAMS = {
  prompt: 'select_account',
} as const;

let googleConfigured = false;
let googleSignInModule: GoogleSignInModule | null | undefined;

/** Expo Go has no RNGoogleSignin native binary — never import the package there. */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getGoogleSignInModule(): GoogleSignInModule | null {
  if (googleSignInModule !== undefined) return googleSignInModule;
  if (isExpoGo() || Platform.OS === 'web') {
    googleSignInModule = null;
    return null;
  }

  try {
    // Lazy require so Expo Go never evaluates TurboModuleRegistry.getEnforcing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    googleSignInModule = null;
  }

  return googleSignInModule;
}

function ensureGoogleNativeConfigured(): string | null {
  if (googleConfigured) return null;

  const native = getGoogleSignInModule();
  if (!native) {
    if (__DEV__) {
      console.warn(
        '[auth] Google Sign-In native module missing — use a development build (not Expo Go).',
      );
    }
    return 'Google Sign-In isn’t available on this device right now. Please try email sign-in, or talk to the front desk.';
  }

  const webClientId = ENV.GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) {
    if (__DEV__) {
      console.warn(
        '[auth] Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild.',
      );
    }
    return 'Google Sign-In isn’t available right now. Please try email sign-in, or talk to the front desk.';
  }

  native.GoogleSignin.configure({
    webClientId,
    iosClientId: ENV.GOOGLE_IOS_CLIENT_ID?.trim() || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
  return null;
}

async function ensureOnlineForGoogleAuth(): Promise<string | null> {
  if (getNetworkOnline()) return null;

  const probedOnline = await probeInternetConnectivity();
  if (probedOnline) return null;

  return 'No internet connection. Check your network and try again.';
}

async function finishGoogleSession(): Promise<AuthResult> {
  const session = await getSupabaseClient().auth.getSession();
  const user = session.data.session?.user;
  if (user) {
    await syncAuthProfileFromSession(session.data.session);
    await completeSignupActivation(user.id, user.email ?? '');
  }
  return { error: null };
}

function isGoogleSignInCancelled(
  error: unknown,
  statusCodes: GoogleSignInModule['statusCodes'],
): boolean {
  return (
    isNativeModuleErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED
  );
}

/** Clears the Google SDK session so the next sign-in shows the account picker. */
export async function signOutGoogleQuietly(): Promise<void> {
  if (Platform.OS === 'web') return;

  const native = getGoogleSignInModule();
  if (!native) return;

  try {
    if (!googleConfigured) {
      const configError = ensureGoogleNativeConfigured();
      if (configError) return;
    }
    await native.GoogleSignin.signOut();
  } catch {
    // No prior Google session — ignore.
  }
}

async function continueWithGoogleNative(): Promise<AuthResult> {
  const configError = ensureGoogleNativeConfigured();
  if (configError) return { error: configError };

  const native = getGoogleSignInModule();
  // ensureGoogleNativeConfigured already verified the module exists.
  if (!native) {
    return { error: 'Google Sign-In isn’t available right now. Please try email sign-in.' };
  }

  const offlineError = await ensureOnlineForGoogleAuth();
  if (offlineError) return { error: offlineError };

  const { GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes } = native;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Force the native account chooser (system "Select an account" sheet).
    await signOutGoogleQuietly();

    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      return { error: null, cancelled: true };
    }

    if (!isSuccessResponse(response)) {
      return { error: 'Google authentication did not complete. Please try again.' };
    }

    let idToken = response.data.idToken;
    let accessToken: string | undefined;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
      accessToken = tokens.accessToken;
    } else {
      try {
        const tokens = await GoogleSignin.getTokens();
        accessToken = tokens.accessToken;
      } catch {
        // Access token is optional for Supabase Google id-token exchange.
      }
    }

    if (!idToken) {
      return { error: 'Google authentication did not return a valid token. Please try again.' };
    }

    const { error } = await getSupabaseClient().auth.signInWithIdToken({
      provider: GOOGLE_PROVIDER,
      token: idToken,
      access_token: accessToken,
    });

    if (error) {
      return { error: formatAuthError(error) };
    }

    return finishGoogleSession();
  } catch (authError) {
    if (isGoogleSignInCancelled(authError, statusCodes)) {
      return { error: null, cancelled: true };
    }
    return { error: formatGoogleNativeError(authError, statusCodes) };
  }
}

/** Browser OAuth — used on web and as Expo Go fallback (no native Google SDK). */
async function continueWithGoogleBrowser(): Promise<AuthResult> {
  const offlineError = await ensureOnlineForGoogleAuth();
  if (offlineError) return { error: offlineError };

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
  if (isGoogleBrowserAuthCancelled(browserResult.type)) {
    return { error: null, cancelled: true };
  }

  if (browserResult.type !== 'success' || !('url' in browserResult) || !browserResult.url) {
    return { error: 'Google authentication did not complete. Please try again.' };
  }

  const sessionResult = await createSessionFromUrl(browserResult.url);
  if (sessionResult.error) {
    return { error: formatAuthError(sessionResult.error) };
  }

  if (sessionResult.recovery) {
    return { error: null, recovery: true };
  }

  return finishGoogleSession();
}

export async function continueWithGoogle(): Promise<AuthResult> {
  // Web has no native Google SDK — browser OAuth only.
  // iOS/Android must use the in-app account picker (dev/prod build, not Expo Go).
  if (Platform.OS === 'web') {
    return continueWithGoogleBrowser();
  }

  return continueWithGoogleNative();
}
