import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { getSupabaseClient } from '@/services/supabase/client';
import { formatAuthError } from './authValidation';
import { syncAuthProfileFromSession } from './authProfileSync';
import { completeSignupActivation } from './postSignupActivation';
import type { AuthResult } from '../types';

function buildAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) return null;

  const parts = [fullName.givenName, fullName.familyName].filter((part): part is string =>
    Boolean(part?.trim()),
  );

  return parts.length > 0 ? parts.join(' ') : null;
}

async function createAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  return { rawNonce, hashedNonce };
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function continueWithApple(): Promise<AuthResult> {
  if (Platform.OS !== 'ios') {
    return { error: 'Sign in with Apple is only available on iOS.' };
  }

  const available = await isAppleAuthAvailable();
  if (!available) {
    return { error: 'Sign in with Apple is not available on this device.' };
  }

  try {
    const { rawNonce, hashedNonce } = await createAppleNonce();

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: 'Apple authentication did not return a valid token. Please try again.' };
    }

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { error: formatAuthError(error) };
    }

    const appleFullName = buildAppleFullName(credential.fullName);
    if (appleFullName && !data.user?.user_metadata?.full_name) {
      await client.auth.updateUser({
        data: { full_name: appleFullName },
      });
    }

    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (user) {
      await syncAuthProfileFromSession(session.data.session);
      await completeSignupActivation(user.id, user.email ?? '');
    }

    return { error: null };
  } catch (authError) {
    if (
      authError &&
      typeof authError === 'object' &&
      'code' in authError &&
      authError.code === 'ERR_REQUEST_CANCELED'
    ) {
      return { error: null, cancelled: true };
    }

    return { error: formatAuthError(authError) };
  }
}
