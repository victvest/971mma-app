const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_./+=-]{32,}\b/g;
const SENSITIVE_KEY_PATTERN =
  /password|passcode|token|secret|authorization|auth|apikey|api_key|anon_key|access_token|refresh_token|session|credential/i;

const MAX_STRING_LENGTH = 1600;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_DEPTH = 4;

function redactText(value: string): string {
  const redacted = value
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(LONG_SECRET_PATTERN, '[redacted-secret]');

  return redacted.length > MAX_STRING_LENGTH
    ? `${redacted.slice(0, MAX_STRING_LENGTH)}...`
    : redacted;
}

export function sanitizeBugText(value: unknown): string {
  if (value instanceof Error) {
    return redactText(value.message || value.name || 'Error');
  }
  if (typeof value === 'string') return redactText(value);
  if (value === null || value === undefined) return '';

  try {
    return redactText(JSON.stringify(value));
  } catch {
    return redactText(String(value));
  }
}

export function sanitizeBugPayloadValue(value: unknown, depth = 0, key = ''): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'symbol') return value.toString();

  if (value instanceof Error) {
    return {
      name: redactText(value.name),
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : null,
    };
  }

  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeBugPayloadValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    for (const [entryKey, entryValue] of entries) {
      result[entryKey] = sanitizeBugPayloadValue(entryValue, depth + 1, entryKey);
    }
    return result;
  }

  return redactText(String(value));
}
