import {
  isAccountBanned,
  isEmailConfirmed,
  normalizeAuthEmail,
  resolveAuthSignInBlock,
  shouldBlockAdminMobileSignIn,
} from '@/shared/auth/signInPolicy';

describe('auth-sign-in integration policy', () => {
  it('normalizes email before lookup', () => {
    expect(normalizeAuthEmail('  Member@Example.COM ')).toBe('member@example.com');
  });

  it('blocks admin accounts from mobile sign-in', () => {
    expect(shouldBlockAdminMobileSignIn('admin')).toBe(true);
    expect(shouldBlockAdminMobileSignIn('member')).toBe(false);
    expect(shouldBlockAdminMobileSignIn('coach')).toBe(false);
  });

  it('requires confirmed email', () => {
    expect(isEmailConfirmed(null)).toBe(false);
    expect(isEmailConfirmed('2024-01-01T00:00:00Z')).toBe(true);
  });

  it('respects active ban window', () => {
    const now = Date.parse('2024-06-01T12:00:00Z');
    expect(isAccountBanned('2024-06-02T00:00:00Z', now)).toBe(true);
    expect(isAccountBanned('2024-05-01T00:00:00Z', now)).toBe(false);
    expect(isAccountBanned(null, now)).toBe(false);
  });

  it('resolves block reasons in priority order', () => {
    expect(
      resolveAuthSignInBlock({
        role: 'admin',
        emailConfirmedAt: null,
        bannedUntil: '2099-01-01T00:00:00Z',
      }),
    ).toBe('admin_blocked');

    expect(
      resolveAuthSignInBlock({
        role: 'member',
        emailConfirmedAt: null,
        bannedUntil: null,
      }),
    ).toBe('email_not_confirmed');

    expect(
      resolveAuthSignInBlock({
        role: 'member',
        emailConfirmedAt: '2024-01-01T00:00:00Z',
        bannedUntil: '2099-01-01T00:00:00Z',
      }),
    ).toBe('account_disabled');

    expect(
      resolveAuthSignInBlock({
        role: 'member',
        emailConfirmedAt: '2024-01-01T00:00:00Z',
        bannedUntil: null,
      }),
    ).toBeNull();
  });
});
