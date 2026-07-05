import { isNetworkOnline, networkStatusFromNetInfo } from '@/core/connectivity/mapNetInfoState';

describe('mapNetInfoState', () => {
  it('treats connected links as online even when reachability is false', () => {
    expect(
      isNetworkOnline({
        isConnected: true,
        isInternetReachable: false,
      }),
    ).toBe(true);
  });

  it('marks offline when the link layer is disconnected', () => {
    expect(
      isNetworkOnline({
        isConnected: false,
        isInternetReachable: false,
      }),
    ).toBe(false);
  });

  it('maps NetInfo state into app connectivity status', () => {
    expect(
      networkStatusFromNetInfo({
        isConnected: true,
        isInternetReachable: false,
        type: 'wifi',
      } as Parameters<typeof networkStatusFromNetInfo>[0]),
    ).toEqual({
      isOnline: true,
      connectionType: 'wifi',
    });
  });
});
