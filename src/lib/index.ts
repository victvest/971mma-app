export type { ApiError, ApiErrorCode } from './apiError';
export { queryClient } from './queryClient';
export { secureStorage, STORAGE_KEYS } from './secureStorage';
export type { StorageKey } from './secureStorage';
export {
  errorMessageIncludes,
  extractErrorCode,
  extractErrorMessage,
  toUserFacingErrorMessage,
  USER_FACING_CONFIG_ERROR,
  USER_FACING_ERROR_FALLBACK,
  USER_FACING_LOAD_ERROR,
  USER_FACING_NETWORK_ERROR,
  USER_FACING_SAVE_ERROR,
} from './userFacingError';
