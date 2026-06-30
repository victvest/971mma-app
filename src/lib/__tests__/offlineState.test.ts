import {
  isOfflineWithoutCache,
  isQueryActivelyLoading,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';

describe('offlineState', () => {
  it('detects offline without cache', () => {
    expect(
      isOfflineWithoutCache({
        networkStatusKnown: true,
        isOnline: false,
        hasData: false,
      }),
    ).toBe(true);

    expect(
      isOfflineWithoutCache({
        networkStatusKnown: true,
        isOnline: false,
        hasData: true,
      }),
    ).toBe(false);

    expect(
      isOfflineWithoutCache({
        networkStatusKnown: false,
        isOnline: false,
        hasData: false,
      }),
    ).toBe(false);

    expect(
      isOfflineWithoutCache({
        networkStatusKnown: true,
        isOnline: true,
        hasData: false,
      }),
    ).toBe(false);

    expect(
      isOfflineWithoutCache({
        networkStatusKnown: true,
        isOnline: false,
        hasData: false,
        hasError: true,
      }),
    ).toBe(false);
  });

  it('treats paused queries as not actively loading', () => {
    expect(isQueryActivelyLoading(false, false)).toBe(false);
    expect(isQueryActivelyLoading(true, false)).toBe(true);
    expect(isQueryActivelyLoading(false, true)).toBe(true);
  });

  it('exports stable offline copy', () => {
    expect(OFFLINE_TITLE.length).toBeGreaterThan(0);
    expect(OFFLINE_MESSAGE.length).toBeGreaterThan(0);
  });
});
