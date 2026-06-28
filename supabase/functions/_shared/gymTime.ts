/** Mindbody class times for a site are gym-local (971 MMA = Asia/Dubai). */
export const GYM_UTC_OFFSET = '+04:00';

const OFFSET_SUFFIX_RE = /([zZ]|[+-]\d{2}:\d{2})$/;

/**
 * Mindbody returns site-local datetimes without a timezone suffix.
 * Store them as UTC instants by anchoring to the gym offset (+04:00).
 */
export function mindbodyLocalDateTimeToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (OFFSET_SUFFIX_RE.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const withTime = trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00`;
  const parsed = new Date(`${withTime}${GYM_UTC_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
