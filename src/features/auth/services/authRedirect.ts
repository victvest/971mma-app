import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const AUTH_CALLBACK_PATH = 'auth/callback';

export function getAuthCallbackHost(): string | null {
  const host = process.env.EXPO_PUBLIC_AUTH_CALLBACK_HOST?.trim();
  return host || null;
}

export function getAuthRedirectPath(platform = Platform.OS): string {
  return platform === 'web' ? '/' : AUTH_CALLBACK_PATH;
}

export function getAuthRedirectUri(): string {
  const host = getAuthCallbackHost();
  if (host && Platform.OS !== 'web' && !__DEV__) {
    return `https://${host}/${AUTH_CALLBACK_PATH}`;
  }

  return Linking.createURL(getAuthRedirectPath());
}

export function isAuthCallbackUrl(url: string): boolean {
  const normalized = url.toLowerCase();

  if (normalized.includes(`/${AUTH_CALLBACK_PATH}`)) {
    return true;
  }

  const host = getAuthCallbackHost();
  if (host && normalized.includes(host.toLowerCase())) {
    return true;
  }

  return (
    normalized.includes('access_token=') ||
    normalized.includes('refresh_token=') ||
    normalized.includes('token_hash=') ||
    (normalized.includes('type=recovery') && normalized.includes('code='))
  );
}
