import { jsonResponse } from './cors.ts';

export type MbErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'NOT_LINKED'
  | 'BAD_REQUEST'
  | 'QUOTA_EXCEEDED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REPLAYED'
  | 'ALREADY_CHECKED_IN'
  | 'FORBIDDEN'
  | 'OUTSIDE_GEOFENCE'
  | 'AMBIGUOUS_MATCH'
  | 'CLIENT_OWNED';

const statusByCode: Record<MbErrorCode, number> = {
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  NOT_LINKED: 409,
  BAD_REQUEST: 400,
  QUOTA_EXCEEDED: 429,
  TOKEN_INVALID: 400,
  TOKEN_EXPIRED: 400,
  TOKEN_REPLAYED: 409,
  ALREADY_CHECKED_IN: 409,
  FORBIDDEN: 403,
  OUTSIDE_GEOFENCE: 403,
  AMBIGUOUS_MATCH: 409,
  CLIENT_OWNED: 409,
};

export class MbError extends Error {
  readonly code: MbErrorCode;
  readonly status: number;

  constructor(code: MbErrorCode, message: string, status = statusByCode[code]) {
    super(message);
    this.name = 'MbError';
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof MbError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return jsonResponse(
    { error: { code: 'UPSTREAM_ERROR', message: 'Unexpected server error.' } },
    { status: 500 },
  );
}
