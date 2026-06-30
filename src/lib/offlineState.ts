export const OFFLINE_TITLE = 'You are offline';
export const OFFLINE_MESSAGE =
  'Connect to the internet to load this screen. Cached content may still be available on other tabs.';
export const OFFLINE_RETRY_LABEL = 'Try again when online';

export type OfflineGateInput = {
  networkStatusKnown: boolean;
  isOnline: boolean;
  hasData: boolean;
  hasError?: boolean;
};

/** True when the device is offline, network state is known, and there is no cached data. */
export function isOfflineWithoutCache({
  networkStatusKnown,
  isOnline,
  hasData,
  hasError = false,
}: OfflineGateInput): boolean {
  return networkStatusKnown && !isOnline && !hasData && !hasError;
}

/** Prefer isLoading over isPending so paused offline queries do not spin forever. */
export function isQueryActivelyLoading(isLoading: boolean, isFetching: boolean): boolean {
  return isLoading || isFetching;
}
