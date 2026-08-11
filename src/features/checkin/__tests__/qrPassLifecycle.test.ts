import {
  formatQrFreshnessLabel,
  getQrMsRemaining,
  isQrTokenExpired,
  qrPassRefetchIntervalMs,
  QR_REFRESH_LEAD_MS,
} from '@/features/checkin/utils/qrPassLifecycle';

describe('qrPassLifecycle', () => {
  const now = Date.parse('2026-07-22T12:00:00.000Z');

  it('detects expired tokens', () => {
    expect(isQrTokenExpired('2026-07-22T11:59:00.000Z', now)).toBe(true);
    expect(isQrTokenExpired('2026-07-22T12:01:00.000Z', now)).toBe(false);
  });

  it('accelerates refetch near expiry', () => {
    const far = new Date(now + 4 * 60_000).toISOString();
    const near = new Date(now + QR_REFRESH_LEAD_MS - 1_000).toISOString();
    const expired = new Date(now - 1_000).toISOString();

    expect(qrPassRefetchIntervalMs(far, now)).toBe(Math.min(60_000, getQrMsRemaining(far, now) - QR_REFRESH_LEAD_MS));
    expect(qrPassRefetchIntervalMs(near, now)).toBe(5_000);
    expect(qrPassRefetchIntervalMs(expired, now)).toBe(5_000);
  });

  it('formats freshness for the member card', () => {
    expect(formatQrFreshnessLabel(new Date(now + 90_000).toISOString(), now)).toMatch(/2m/);
    expect(formatQrFreshnessLabel(new Date(now + 20_000).toISOString(), now)).toMatch(/20s/);
    expect(formatQrFreshnessLabel(new Date(now - 1_000).toISOString(), now)).toBe('Refreshing pass…');
  });
});
