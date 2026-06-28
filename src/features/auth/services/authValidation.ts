const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_NUMBER = /\d/;

export const MIN_PASSWORD_LENGTH = 6;
export const DEFAULT_EMAIL_DOMAIN_SUGGESTION = 'gmail.com';

export type PasswordRules = {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
};

export type AuthErrorCode =
  | 'EMAIL_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'EMAIL_NOT_CONFIRMED'
  | 'ACCOUNT_DISABLED'
  | 'EMAIL_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';

const AUTH_ERROR_CODES = new Set<AuthErrorCode>([
  'EMAIL_NOT_FOUND',
  'WRONG_PASSWORD',
  'EMAIL_NOT_CONFIRMED',
  'ACCOUNT_DISABLED',
  'EMAIL_EXISTS',
  'WEAK_PASSWORD',
  'INVALID_OTP',
  'OTP_EXPIRED',
  'RATE_LIMITED',
  'NETWORK',
  'UNKNOWN',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(normalized)) return 'Enter a valid email address.';
  return null;
}

export function getPasswordRules(password: string): PasswordRules {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasLetter: HAS_LETTER.test(password),
    hasNumber: HAS_NUMBER.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const rules = getPasswordRules(password);
  return rules.minLength && rules.hasLetter && rules.hasNumber;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter your password.';
  const rules = getPasswordRules(password);
  if (!rules.minLength) return 'Password must be at least 6 characters.';
  if (!rules.hasLetter) return 'Password must include at least one letter.';
  if (!rules.hasNumber) return 'Password must include at least one number.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  const passwordError = validatePassword(password);
  if (passwordError) return passwordError;
  if (!confirmPassword) return 'Confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

export function validateOtpCode(code: string): string | null {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return 'Enter the 6-digit code from your email.';
  return null;
}

export function shouldShowEmailDomainSuggestion(email: string): boolean {
  return email.endsWith('@');
}

export function applyEmailDomainSuggestion(email: string, domain = DEFAULT_EMAIL_DOMAIN_SUGGESTION): string {
  if (!email.endsWith('@')) return email;
  return `${email}${domain}`;
}

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string') return message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

function getAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  if ('rawCode' in error && typeof error.rawCode === 'string') return error.rawCode;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return null;
}

export function mapAuthErrorCode(code: AuthErrorCode, fallback?: string): string {
  switch (code) {
    case 'EMAIL_NOT_FOUND':
      return 'No account found for this email address.';
    case 'WRONG_PASSWORD':
      return 'Incorrect password. Try again or reset it.';
    case 'EMAIL_NOT_CONFIRMED':
      return 'Confirm your email before signing in. Check your inbox for the verification code.';
    case 'ACCOUNT_DISABLED':
      return 'This account has been disabled. Contact support for help.';
    case 'EMAIL_EXISTS':
      return 'An account already exists for this email. Sign in instead.';
    case 'WEAK_PASSWORD':
      return 'Password must be at least 6 characters and include letters and numbers.';
    case 'INVALID_OTP':
      return 'Wrong code. Check your email and try again.';
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute and try again.';
    case 'NETWORK':
      return 'Unable to reach the auth server. Check your connection and try again.';
    default:
      return fallback ?? 'Something went wrong. Check your connection and try again.';
  }
}

export function formatAuthError(error: unknown): string {
  const explicitCode = getAuthErrorCode(error);
  if (explicitCode && AUTH_ERROR_CODES.has(explicitCode as AuthErrorCode)) {
    return mapAuthErrorCode(explicitCode as AuthErrorCode, getAuthErrorMessage(error));
  }

  const message = getAuthErrorMessage(error).trim();
  if (!message) return mapAuthErrorCode('UNKNOWN');

  const lower = message.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('too many')) {
    return mapAuthErrorCode('RATE_LIMITED');
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return mapAuthErrorCode('NETWORK');
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('email address is already registered') ||
    lower.includes('email_exists')
  ) {
    return mapAuthErrorCode('EMAIL_EXISTS');
  }
  if (
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed') ||
    lower.includes('confirm your email')
  ) {
    return mapAuthErrorCode('EMAIL_NOT_CONFIRMED');
  }
  if (lower.includes('otp_expired')) {
    return mapAuthErrorCode('OTP_EXPIRED');
  }
  if (
    lower.includes('invalid otp') ||
    lower.includes('otp_disabled') ||
    lower.includes('token has expired or is invalid')
  ) {
    // Supabase uses the same message for wrong and expired codes — prefer "incorrect".
    return mapAuthErrorCode('INVALID_OTP');
  }
  if (lower.includes('expired') && lower.includes('otp')) {
    return mapAuthErrorCode('OTP_EXPIRED');
  }
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak password') ||
    lower.includes('weak_password')
  ) {
    return mapAuthErrorCode('WEAK_PASSWORD');
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('user not found') || lower.includes('user_not_found')) {
    return mapAuthErrorCode('EMAIL_NOT_FOUND');
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }
  if (lower.includes('signup is disabled') || lower.includes('signups not allowed')) {
    return 'New signups are currently disabled. Contact support for help.';
  }
  if (lower.includes('banned') || lower.includes('disabled')) {
    return mapAuthErrorCode('ACCOUNT_DISABLED');
  }

  return message;
}
