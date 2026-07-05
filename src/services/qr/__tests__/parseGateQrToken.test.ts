import {
  isMemberQrToken,
  parseGateQrToken,
} from '@/services/qr/parseGateQrToken';

describe('gate QR token parser (v2 contract)', () => {
  const validToken =
    '971mma:v2:gate:location-1:1893456000:550e8400-e29b-41d4-a716-446655440000:abc123sig';

  it('parses the 7-part gate token format', () => {
    expect(parseGateQrToken(validToken)).toEqual({
      locationId: 'location-1',
      exp: 1893456000,
      jti: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('rejects member pass tokens', () => {
    expect(parseGateQrToken('971mma:v1:supabase:user-1')).toBeNull();
    expect(isMemberQrToken('971mma:v1:supabase:user-1')).toBe(true);
  });

  it('rejects wrong segment counts and sources', () => {
    expect(parseGateQrToken('971mma:v2:gate:loc:exp')).toBeNull();
    expect(parseGateQrToken('971mma:v1:gate:loc:exp:jti:sig')).toBeNull();
    expect(parseGateQrToken('971mma:v2:member:loc:exp:jti:sig')).toBeNull();
  });

  it('rejects non-numeric expiry', () => {
    expect(
      parseGateQrToken('971mma:v2:gate:loc:not-a-number:jti:sig'),
    ).toBeNull();
  });

  it('distinguishes member passes from entrance codes', () => {
    expect(isMemberQrToken(validToken)).toBe(false);
    expect(isMemberQrToken('971mma:v1:mindbody:123')).toBe(true);
    expect(isMemberQrToken('invalid')).toBe(false);
  });
});

describe('gate token client/server field contract', () => {
  it('keeps field order aligned with server gateToken.ts', () => {
    const token =
      '971mma:v2:gate:971-dubai:1700000000:jti-abc:Zm9vYmFy';

    const parts = token.split(':');
    expect(parts).toHaveLength(7);
    expect(parts[0]).toBe('971mma');
    expect(parts[1]).toBe('v2');
    expect(parts[2]).toBe('gate');
    expect(parts[3]).toBe('971-dubai');
    expect(parts[4]).toBe('1700000000');
    expect(parts[5]).toBe('jti-abc');
    expect(parts[6]).toBe('Zm9vYmFy');

    expect(parseGateQrToken(token)).toEqual({
      locationId: '971-dubai',
      exp: 1700000000,
      jti: 'jti-abc',
    });
  });
});
