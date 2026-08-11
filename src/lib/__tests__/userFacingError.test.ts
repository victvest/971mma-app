import {
  errorMessageIncludes,
  extractErrorCode,
  toUserFacingErrorMessage,
  USER_FACING_CONFIG_ERROR,
  USER_FACING_ERROR_FALLBACK,
  USER_FACING_NETWORK_ERROR,
} from '@/lib/userFacingError';

describe('toUserFacingErrorMessage', () => {
  it('maps known codes', () => {
    expect(toUserFacingErrorMessage({ message: 'x', rawCode: 'UNAUTHORIZED' })).toMatch(
      /sign in again/i,
    );
    expect(toUserFacingErrorMessage(new Error('INSUFFICIENT_POINTS'))).toMatch(/points/i);
  });

  it('maps network-ish raw messages', () => {
    expect(toUserFacingErrorMessage(new Error('Network request failed'))).toBe(
      USER_FACING_NETWORK_ERROR,
    );
  });

  it('never returns PostgREST / env / stack-style messages', () => {
    expect(
      toUserFacingErrorMessage(new Error('Could not find the function public.foo in the schema cache')),
    ).toBe(USER_FACING_ERROR_FALLBACK);
    expect(
      toUserFacingErrorMessage(
        'Supabase is not configured. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL.',
      ),
    ).toBe(USER_FACING_ERROR_FALLBACK);
    expect(toUserFacingErrorMessage(new Error('TypeError: undefined is not a function'))).toBe(
      USER_FACING_ERROR_FALLBACK,
    );
    expect(toUserFacingErrorMessage(new Error('Class id is required.'))).toBe(
      USER_FACING_ERROR_FALLBACK,
    );
    expect(toUserFacingErrorMessage(new Error('Not authenticated'))).toMatch(/sign in/i);
  });

  it('keeps already-friendly member copy', () => {
    const friendly = 'Membership is paused. Please contact front desk.';
    expect(toUserFacingErrorMessage(new Error(friendly))).toBe(friendly);
  });

  it('uses contextual fallback when provided', () => {
    expect(
      toUserFacingErrorMessage(new Error('PGRST116'), {
        fallback: 'Could not load the schedule.',
      }),
    ).toBe('Could not load the schedule.');
  });

  it('detects codes embedded in messages', () => {
    expect(extractErrorCode(new Error('RPC failed: ALREADY_REFERRED'))).toBe('ALREADY_REFERRED');
    expect(errorMessageIncludes(new Error('PUSH_TOKEN_REQUIRED'), 'PUSH_TOKEN_REQUIRED')).toBe(
      true,
    );
  });

  it('exposes config-safe constant', () => {
    expect(USER_FACING_CONFIG_ERROR).toMatch(/front desk/i);
  });
});
