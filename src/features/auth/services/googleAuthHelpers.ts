/**
 * Pure helpers for Google auth (no native module imports — safe for Jest).
 */

/** Reversed iOS OAuth client ID → URL scheme for the Expo config plugin. */
export function googleIosUrlSchemeFromClientId(iosClientId: string): string | null {
  const trimmed = iosClientId.trim();
  const match = /^([a-z0-9-]+)\.apps\.googleusercontent\.com$/i.exec(trimmed);
  if (!match) return null;
  return `com.googleusercontent.apps.${match[1]}`;
}

/** Web / Expo auth-session cancel or dismiss (browser fallback only). */
export function isGoogleBrowserAuthCancelled(resultType: string): boolean {
  return resultType === 'cancel' || resultType === 'dismiss';
}

export function isNativeModuleErrorWithCode(
  error: unknown,
): error is Error & { code: string } {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function formatGoogleNativeError(
  error: unknown,
  statusCodes: { PLAY_SERVICES_NOT_AVAILABLE: string; IN_PROGRESS: string; SIGN_IN_REQUIRED: string },
): string {
  if (isNativeModuleErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is missing or outdated. Update Play Services and try again.';
      case statusCodes.IN_PROGRESS:
        return 'Google sign-in is already in progress.';
      case statusCodes.SIGN_IN_REQUIRED:
        return 'Please choose a Google account to continue.';
      default:
        return `Google authentication failed (${error.code}). Please try again.`;
    }
  }

  if (error instanceof Error && error.message) {
    return `Google authentication failed (${error.message}). Please try again.`;
  }

  return 'Google authentication failed. Please try again.';
}
