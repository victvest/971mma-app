/** Gate display QR issue response (`gate-qr-issue` Edge Function). */
export type GateQrResponse = {
  token: string;
  expiresAt: string;
  locationId: string;
  refreshInSeconds: number;
};

/** Member entrance check-in request (`entry-checkin` Edge Function). */
export type EntryCheckinRequest = {
  gateToken: string;
  latitude: number;
  longitude: number;
  targetUserId?: string;
  confirmMinorPresent?: boolean;
};

/** Successful entrance check-in. */
export type EntryCheckinSuccess = {
  success: true;
  memberName: string;
  checkedInAt: string;
  checkInId: string;
  guardianProxy?: boolean;
};

/** Guardian proxy requires staff/member confirmation before recording visit. */
export type EntryCheckinNeedsConfirmation = {
  needsConfirmation: true;
  memberId: string;
  memberName: string;
  message: string;
};

export type EntryCheckinResponse = EntryCheckinSuccess | EntryCheckinNeedsConfirmation;

/**
 * Edge error codes for gate entry flows — maps to qr-entry-plan.md scenario matrix.
 * @see G1–G8 gate display · M1–M12 member scan · X1–X8 security
 */
export type GateEntryErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'OUTSIDE_GEOFENCE'
  | 'ALREADY_CHECKED_IN'
  | 'NOT_LINKED'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED';

export type GateEntryErrorBody = {
  error: {
    code: GateEntryErrorCode;
    message: string;
    distanceM?: number;
  };
};
