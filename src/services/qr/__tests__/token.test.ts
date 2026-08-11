import { buildMemberQrToken, parseMemberQrToken, QR_PREFIX, QR_VERSION } from '@/services/qr/token';

describe('member QR token (v1)', () => {
  it('builds v1 supabase tokens', () => {
    expect(buildMemberQrToken('member-123')).toBe('971mma:v1:supabase:member-123');
    expect(buildMemberQrToken('mb-456', 'mindbody')).toBe('971mma:v1:mindbody:mb-456');
  });

  it('parses valid v1 tokens', () => {
    expect(parseMemberQrToken('971mma:v1:supabase:user-1')).toEqual({
      memberId: 'user-1',
      source: 'supabase',
    });
    expect(parseMemberQrToken('971mma:v1:mindbody:client-9')).toEqual({
      memberId: 'client-9',
      source: 'mindbody',
    });
  });

  it('parses v2 signed member pass tokens (client-side ID extraction)', () => {
    const exp = Math.floor(Date.now() / 1000) + 90;
    expect(parseMemberQrToken(`971mma:v2:supabase:user-abc:${exp}:jti-1:fake-sig`)).toEqual({
      memberId: 'user-abc',
      source: 'supabase',
      exp,
      jti: 'jti-1',
    });
    expect(parseMemberQrToken(`971mma:v2:mindbody:mb-99:${exp}:jti-2:sig`)).toEqual({
      memberId: 'mb-99',
      source: 'mindbody',
      exp,
      jti: 'jti-2',
    });
  });

  it('rejects malformed or unsupported tokens', () => {
    expect(parseMemberQrToken('')).toBeNull();
    expect(parseMemberQrToken('971mma:v2:gate:1:123:abc:sig')).toBeNull();
    expect(parseMemberQrToken('971mma:v1:unknown:id')).toBeNull();
    expect(parseMemberQrToken('971mma:v1:supabase')).toBeNull();
    expect(parseMemberQrToken('other:v1:supabase:id')).toBeNull();
    expect(parseMemberQrToken('971mma:v2:supabase:user:bad-exp:jti:sig')).toEqual({
      memberId: 'user',
      source: 'supabase',
      exp: undefined,
      jti: 'jti',
    });
  });

  it('trims whitespace before parsing', () => {
    expect(parseMemberQrToken('  971mma:v1:supabase:trimmed  ')).toEqual({
      memberId: 'trimmed',
      source: 'supabase',
    });
  });

  it('exports stable prefix and version constants', () => {
    expect(QR_PREFIX).toBe('971mma');
    expect(QR_VERSION).toBe('v1');
  });
});
