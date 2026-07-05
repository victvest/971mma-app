import { classifyCheckInError, classifyEntranceCheckInError } from '@/features/checkin/utils/checkInErrors';
import type { ApiError } from '@/lib/apiError';

function apiError(rawCode: string, message: string): ApiError {
  return { code: 'UNKNOWN', message, status: 400, rawCode };
}

describe('checkInErrors — QR and gate scan error mapping', () => {
  it('maps TOKEN_INVALID to invalid_qr', () => {
    const result = classifyCheckInError(apiError('TOKEN_INVALID', 'Invalid token'));
    expect(result.reason).toBe('invalid_qr');
  });

  it('maps TOKEN_EXPIRED to qr_expired', () => {
    const result = classifyCheckInError(apiError('TOKEN_EXPIRED', 'Expired'));
    expect(result.reason).toBe('qr_expired');
  });

  it('maps TOKEN_REPLAYED to qr_replayed', () => {
    const result = classifyCheckInError(apiError('TOKEN_REPLAYED', 'Used'));
    expect(result.reason).toBe('qr_replayed');
  });

  it('maps OUTSIDE_GEOFENCE', () => {
    const result = classifyCheckInError(apiError('OUTSIDE_GEOFENCE', 'Too far'));
    expect(result.reason).toBe('outside_geofence');
  });

  it('maps ALREADY_CHECKED_IN', () => {
    const result = classifyCheckInError(apiError('ALREADY_CHECKED_IN', 'Done'));
    expect(result.reason).toBe('already_checked_in');
  });

  it('maps FORBIDDEN to not_eligible', () => {
    const result = classifyCheckInError(apiError('FORBIDDEN', 'Not allowed'));
    expect(result.reason).toBe('not_eligible');
  });

  it('maps RATE_LIMITED to network_or_server_error', () => {
    const result = classifyCheckInError(apiError('RATE_LIMITED', 'Slow down'));
    expect(result.reason).toBe('network_or_server_error');
  });

  it('maps Mindbody upstream failure', () => {
    const result = classifyCheckInError(
      apiError('UPSTREAM_ERROR', 'Mindbody arrival write-back failed.'),
    );
    expect(result.reason).toBe('mindbody_arrival_failed');
  });

  it('entrance presentation uses QR expired copy', () => {
    const presentation = classifyEntranceCheckInError(apiError('TOKEN_EXPIRED', 'Expired'));
    expect(presentation.title).toBe('QR expired');
    expect(presentation.message).toContain('latest QR');
  });
});
