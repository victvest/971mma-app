import type { WebBrowserAuthSessionResult } from 'expo-web-browser';

export function isGoogleAuthCancelled(resultType: WebBrowserAuthSessionResult['type']): boolean {
  return resultType === 'cancel' || resultType === 'dismiss';
}
