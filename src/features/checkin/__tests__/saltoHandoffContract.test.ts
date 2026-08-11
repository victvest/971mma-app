/**
 * Frozen SALTO handoff contract assertions (client-safe).
 * NexusOne depends on these shapes — do not weaken these tests.
 */
import { QR_PREFIX, parseMemberQrToken } from '@/services/qr/token';

describe('SALTO handoff contract (frozen)', () => {
  it('QR format matches handoff: 971mma:v2:supabase:<userId>:<exp>:<jti>:<sig>', () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = `${QR_PREFIX}:v2:supabase:11111111-1111-4111-8111-111111111111:${exp}:jti-abc:signature`;
    const parsed = parseMemberQrToken(token);
    expect(parsed).toEqual({
      memberId: '11111111-1111-4111-8111-111111111111',
      source: 'supabase',
      exp,
      jti: 'jti-abc',
    });
  });

  it('Access by Media request keys remain Data / Type / DeviceId (documented)', () => {
    // Documentation lock — SALTO Postman body. Changing these strings is a breaking change.
    const request = { Data: 'token', Type: 'QR', DeviceId: 'GT7-ENTRY-01' };
    expect(Object.keys(request).sort()).toEqual(['Data', 'DeviceId', 'Type']);
    expect(request.Type).toBe('QR');
  });

  it('Access response keys remain Granted / Message (documented)', () => {
    const granted = { Granted: true, Message: 'Access granted.' };
    const denied = { Granted: false, Message: 'QR expired. Refresh your pass in the app.' };
    expect(Object.keys(granted).sort()).toEqual(['Granted', 'Message']);
    expect(Object.keys(denied).sort()).toEqual(['Granted', 'Message']);
    expect(typeof granted.Granted).toBe('boolean');
    expect(typeof denied.Message).toBe('string');
  });
});
