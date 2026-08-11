/** Pure QR pass timing helpers — no React / network. */

export const QR_TOKEN_TTL_SECONDS = 5 * 60;
/** Refresh before the gate rejects the pass. */
export const QR_REFRESH_LEAD_MS = 30_000;

export function getQrMsRemaining(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return 0;
  return exp - now;
}

export function isQrTokenExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  return getQrMsRemaining(expiresAt, now) <= 0;
}

/**
 * React Query refetchInterval: poll every 60s normally, then accelerate within
 * the lead window so the member never presents a dead QR at the gate.
 */
export function qrPassRefetchIntervalMs(
  expiresAt: string | null | undefined,
  now = Date.now(),
): number | false {
  if (!expiresAt) return 60_000;
  const msLeft = getQrMsRemaining(expiresAt, now);
  if (msLeft <= 0) return 5_000;
  if (msLeft <= QR_REFRESH_LEAD_MS) return 5_000;
  return Math.min(60_000, Math.max(5_000, msLeft - QR_REFRESH_LEAD_MS));
}

export function formatQrFreshnessLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  const msLeft = getQrMsRemaining(expiresAt, now);
  if (msLeft <= 0) return 'Refreshing pass…';
  const seconds = Math.ceil(msLeft / 1000);
  if (seconds <= 60) return `Pass refreshes in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `Pass refreshes in ${minutes}m`;
}
