import type { ApiError } from '@/lib/apiError';
import {
  LocationPermissionError,
  LocationTimeoutError,
} from '@/features/checkin/utils/entranceLocation';

export type CheckInFailureReason =
  | 'already_checked_in'
  | 'not_linked'
  | 'mindbody_arrival_failed'
  | 'network_or_server_error'
  | 'not_eligible'
  | 'invalid_qr'
  | 'qr_expired'
  | 'qr_replayed'
  | 'outside_geofence'
  | 'location_denied'
  | 'location_timeout'
  | 'unknown';

export const CHECK_IN_REASON_LABELS: Record<CheckInFailureReason, string> = {
  already_checked_in: 'Already checked in',
  not_linked: 'Not linked',
  mindbody_arrival_failed: 'Gym check-in failed',
  network_or_server_error: 'Network or server error',
  not_eligible: 'Not eligible',
  invalid_qr: 'Invalid QR code',
  qr_expired: 'QR expired',
  qr_replayed: 'QR already used',
  outside_geofence: 'Outside academy',
  location_denied: 'Location denied',
  location_timeout: 'Location timeout',
  unknown: 'Check-in failed',
};

function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'message' in error && 'code' in error);
}

export function classifyCheckInError(error: unknown): {
  reason: CheckInFailureReason;
  message: string;
} {
  if (!isApiError(error)) {
    return { reason: 'unknown', message: 'Check-in failed.' };
  }

  const message = error.message || 'Check-in failed.';
  const rawCode = error.rawCode;

  switch (rawCode) {
    case 'ALREADY_CHECKED_IN':
      return { reason: 'already_checked_in', message };
    case 'NOT_LINKED':
      return { reason: 'not_linked', message };
    case 'TOKEN_INVALID':
      return { reason: 'invalid_qr', message };
    case 'TOKEN_EXPIRED':
      return { reason: 'qr_expired', message };
    case 'TOKEN_REPLAYED':
      return { reason: 'qr_replayed', message };
    case 'OUTSIDE_GEOFENCE':
      return { reason: 'outside_geofence', message };
    case 'RATE_LIMITED':
      return { reason: 'network_or_server_error', message };
    case 'FORBIDDEN':
      return { reason: 'not_eligible', message };
    case 'UPSTREAM_ERROR':
      if (message.toLowerCase().includes('mindbody arrival')) {
        return { reason: 'mindbody_arrival_failed', message };
      }
      return { reason: 'network_or_server_error', message };
    default:
      break;
  }

  switch (error.code) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return { reason: 'network_or_server_error', message };
    case 'SERVER_ERROR':
      return { reason: 'network_or_server_error', message };
    case 'FORBIDDEN':
      return { reason: 'not_eligible', message };
    default:
      return { reason: 'unknown', message };
  }
}

export function formatBulkCheckInSummary(
  success: number,
  skipped: Partial<Record<CheckInFailureReason, number>>,
): string {
  const parts = [`Marked ${success} member${success === 1 ? '' : 's'} in`];

  const skipParts = (Object.keys(skipped) as CheckInFailureReason[])
    .filter((reason) => (skipped[reason] ?? 0) > 0)
    .map((reason) => `${skipped[reason]} ${CHECK_IN_REASON_LABELS[reason].toLowerCase()}`);

  if (skipParts.length > 0) {
    parts.push(`Skipped: ${skipParts.join(', ')}`);
  }

  return parts.join('. ') + '.';
}

export type EntranceCheckInErrorPresentation = {
  reason: CheckInFailureReason;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function classifyEntranceCheckInError(error: unknown): EntranceCheckInErrorPresentation {
  if (error instanceof LocationPermissionError) {
    return {
      reason: 'location_denied',
      title: 'Location required',
      message: error.message,
      actionLabel: 'Open Settings',
    };
  }

  if (error instanceof LocationTimeoutError) {
    return {
      reason: 'location_timeout',
      title: 'Location unavailable',
      message: error.message,
      actionLabel: 'Try again',
    };
  }

  const classified = classifyCheckInError(error);

  switch (classified.reason) {
    case 'outside_geofence':
      return {
        reason: classified.reason,
        title: 'Too far from academy',
        message: classified.message,
        actionLabel: 'Try again',
      };
    case 'already_checked_in':
      return {
        reason: classified.reason,
        title: 'Already checked in',
        message: classified.message,
        actionLabel: 'OK',
      };
    case 'not_linked':
      return {
        reason: classified.reason,
        title: 'Account not linked',
        message: classified.message,
        actionLabel: 'Try again',
      };
    case 'qr_expired':
      return {
        reason: classified.reason,
        title: 'QR expired',
        message: 'The entrance code refreshed. Scan the latest QR on the tablet.',
        actionLabel: 'Try again',
      };
    case 'invalid_qr':
      return {
        reason: classified.reason,
        title: 'Invalid QR code',
        message: classified.message,
        actionLabel: 'Try again',
      };
    case 'network_or_server_error':
      return {
        reason: classified.reason,
        title: 'Check-in failed',
        message: classified.message,
        actionLabel: 'Try again',
      };
    default:
      return {
        reason: classified.reason,
        title: 'Check-in failed',
        message: classified.message,
        actionLabel: 'Try again',
      };
  }
}
