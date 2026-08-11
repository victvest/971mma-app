import { sanitizeBugPayloadValue, sanitizeBugText } from '../privacy';

describe('bug telemetry privacy sanitization', () => {
  it('redacts emails and token-like strings from text', () => {
    const text = sanitizeBugText(
      'Login failed for omar@example.com with Bearer abc.def.ghi and eyJabc.def.ghi',
    );

    expect(text).toContain('[email]');
    expect(text).toContain('Bearer [redacted]');
    expect(text).toContain('[redacted-jwt]');
    expect(text).not.toContain('omar@example.com');
  });

  it('redacts sensitive object keys recursively', () => {
    const sanitized = sanitizeBugPayloadValue({
      action: 'sign_in',
      password: 'super-secret',
      nested: {
        refreshToken: 'refresh-token',
        email: 'member@example.com',
      },
    });

    expect(sanitized).toEqual({
      action: 'sign_in',
      password: '[redacted]',
      nested: {
        refreshToken: '[redacted]',
        email: '[email]',
      },
    });
  });
});
