export type ApiErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export type ApiError = {
  message: string;
  code: ApiErrorCode;
  status: number | null;
  rawCode?: string;
};

export function isApiError(error: unknown): error is ApiError {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as Partial<ApiError>;
  return typeof maybe.message === 'string' && typeof maybe.code === 'string';
}
