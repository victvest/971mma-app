/**
 * Maps any thrown/query error into member-safe copy for the UI.
 * Never surface PostgREST, stack traces, env/config, or API internals.
 */

export const USER_FACING_ERROR_FALLBACK =
  'Something went wrong. Please try again, or talk to the front desk for help.';

export const USER_FACING_NETWORK_ERROR = 'Check your connection and try again.';

export const USER_FACING_LOAD_ERROR =
  'We couldn’t load this right now. Please try again, or talk to the front desk.';

export const USER_FACING_SAVE_ERROR =
  'We couldn’t save that. Please try again, or talk to the front desk.';

export const USER_FACING_CONFIG_ERROR =
  'This feature is temporarily unavailable. Please try again later, or talk to the front desk.';

const CODE_MESSAGES: Record<string, string> = {
  TIMEOUT: USER_FACING_NETWORK_ERROR,
  NETWORK_ERROR: USER_FACING_NETWORK_ERROR,
  NETWORK: USER_FACING_NETWORK_ERROR,
  UNAUTHORIZED: 'Please sign in again.',
  FORBIDDEN: 'You don’t have permission to do that. Talk to the front desk if you need help.',
  NOT_FOUND: 'We couldn’t find what you were looking for.',
  SERVER_ERROR: USER_FACING_ERROR_FALLBACK,
  UNKNOWN: USER_FACING_ERROR_FALLBACK,
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  NOT_AUTHENTICATED: 'Please sign in again.',
  NOT_LINKED: 'Your membership isn’t linked yet. Please talk to the front desk.',
  AMBIGUOUS_MATCH: 'We found more than one membership match. Please talk to the front desk.',
  ALREADY_CHECKED_IN: 'This member is already checked in.',
  PUSH_TOKEN_REQUIRED: 'Enable notifications to continue.',
  CLASS_STARTED: 'You can only subscribe to upcoming classes.',
  CLASS_CANCELLED: 'This class is no longer on the schedule.',
  INVALID_CODE: 'Check the code and try again.',
  ALREADY_REFERRED: 'A referral is already linked to your account.',
  ALREADY_ACTIVE: 'Referral codes can only be used before activation.',
  SELF_REFERRAL: 'You cannot use your own referral code.',
  INSUFFICIENT_POINTS: 'Not enough points for this reward.',
  OUT_OF_STOCK: 'This reward just sold out. Pull to refresh the catalog.',
  REWARD_UNAVAILABLE: 'This reward is no longer available.',
  REWARD_LOCKED: 'Reach a higher points tier to unlock this reward.',
  REDEMPTION_LIMIT_REACHED: 'You’ve already redeemed the maximum for this reward.',
  ALREADY_MARKED: 'This member is already on the roll call list.',
};

const TECHNICAL_PATTERN =
  /\b(pgrst\d*|postgrest|postgres|sqlstate|jwt|stack trace|typeerror|referenceerror|syntaxerror|rangeerror|econnrefused|enotfound|etimedout|socket|supabase|mindbody api|edge function|rpc\b|graphql|axios|fetch failed|status code|http\/1|expo_public_|eas project|\.env\b|service_role|anon key|row-level security|rls\b|foreign key|unique constraint|violates|undefined is not|null is not|cannot read propert|is not a function|native module|development build|schema cache|permission denied)\b/i;

const INTERNAL_PREFIX_PATTERN =
  /^(unable to |failed to |could not find |error:|exception:|warning:|debug:|\[)/i;

const DEV_REQUIREMENT_PATTERN =
  /^(class|coach|member|user|session|promotion|requirement) id is required\.?$/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Raw message for code checks only — never render this in UI. */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return normalizeWhitespace(error);
  if (!error || typeof error !== 'object') return '';

  if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
    return normalizeWhitespace((error as { message: string }).message);
  }

  return '';
}

export function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    const raw = extractErrorMessage(error);
    if (/^[A-Z][A-Z0-9_]+$/.test(raw)) return raw;
    return null;
  }

  const maybe = error as { rawCode?: unknown; code?: unknown; message?: unknown };
  if (typeof maybe.rawCode === 'string' && maybe.rawCode.trim()) {
    return maybe.rawCode.trim().toUpperCase();
  }
  if (typeof maybe.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(maybe.code.trim())) {
    return maybe.code.trim().toUpperCase();
  }

  const message = extractErrorMessage(error);
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return message;

  for (const code of Object.keys(CODE_MESSAGES)) {
    if (message.toUpperCase().includes(code)) return code;
  }

  return null;
}

export function errorMessageIncludes(error: unknown, token: string): boolean {
  const needle = token.trim().toUpperCase();
  if (!needle) return false;
  if (extractErrorCode(error) === needle) return true;
  return extractErrorMessage(error).toUpperCase().includes(needle);
}

function looksTechnical(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) return true;
  if (trimmed.includes('{') || trimmed.includes('[') || trimmed.includes('`')) return true;
  if (TECHNICAL_PATTERN.test(trimmed)) return true;
  if (INTERNAL_PREFIX_PATTERN.test(trimmed)) return true;
  if (DEV_REQUIREMENT_PATTERN.test(trimmed)) return true;
  if (/^not authenticated\.?$/i.test(trimmed)) return true;
  if (/at [A-Za-z0-9_$.]+\s*\(/.test(trimmed)) return true;
  if (trimmed.includes('\n') && trimmed.length > 120) return true;
  if (/https?:\/\//i.test(trimmed) && /supabase|googleapis|mindbody/i.test(trimmed)) return true;
  return false;
}

function looksMemberFriendly(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length < 8 || trimmed.length > 220) return false;
  if (!/\s/.test(trimmed)) return false;
  if (looksTechnical(trimmed)) return false;
  return true;
}

function mapNetworkish(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('internet') ||
    lower.includes('connection') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed')
  ) {
    return USER_FACING_NETWORK_ERROR;
  }
  return null;
}

export function toUserFacingErrorMessage(
  error: unknown,
  options?: { fallback?: string },
): string {
  const fallback = options?.fallback?.trim() || USER_FACING_ERROR_FALLBACK;
  const code = extractErrorCode(error);
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  const raw = extractErrorMessage(error);
  if (!raw) return fallback;

  if (/^not authenticated\.?$/i.test(raw)) {
    return CODE_MESSAGES.NOT_AUTHENTICATED;
  }

  const network = mapNetworkish(raw);
  if (network) return network;

  if (looksMemberFriendly(raw)) return raw;

  return fallback;
}
