/** Pure auth-sign-in policy rules — mirrored by auth-sign-in Edge Function. */

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function shouldBlockAdminMobileSignIn(role: string | undefined | null): boolean {
  return role === 'admin';
}

export function isEmailConfirmed(confirmedAt: string | null | undefined): boolean {
  return Boolean(confirmedAt);
}

export function isAccountBanned(bannedUntil: string | null | undefined, now = Date.now()): boolean {
  if (!bannedUntil) return false;
  const bannedUntilMs = new Date(bannedUntil).getTime();
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > now;
}

export type AuthSignInBlockReason = 'admin_blocked' | 'email_not_confirmed' | 'account_disabled';

export function resolveAuthSignInBlock(params: {
  role: string | null | undefined;
  emailConfirmedAt: string | null | undefined;
  bannedUntil: string | null | undefined;
  now?: number;
}): AuthSignInBlockReason | null {
  if (shouldBlockAdminMobileSignIn(params.role ?? undefined)) {
    return 'admin_blocked';
  }
  if (!isEmailConfirmed(params.emailConfirmedAt)) {
    return 'email_not_confirmed';
  }
  if (isAccountBanned(params.bannedUntil, params.now)) {
    return 'account_disabled';
  }
  return null;
}
