import {
  checkGeofence,
  haversineDistanceM,
  isGuardianProxyCheckIn,
  requiresMinorPresenceConfirmation,
} from '@/shared/checkin/entryCheckinPolicy';

const ACADEMY: { academyLat: number; academyLng: number; radiusM: number } = {
  academyLat: 25.1172,
  academyLng: 55.1984,
  radiusM: 150,
};

describe('entry-checkin integration policy', () => {
  it('allows check-in at academy coordinates', () => {
    const result = checkGeofence(ACADEMY.academyLat, ACADEMY.academyLng, ACADEMY);
    expect(result.allowed).toBe(true);
    expect(result.distanceM).toBe(0);
  });

  it('rejects check-in far outside geofence', () => {
    const result = checkGeofence(25.2048, 55.2708, ACADEMY);
    expect(result.allowed).toBe(false);
    expect(result.distanceM).toBeGreaterThan(ACADEMY.radiusM);
  });

  it('computes haversine distance consistently', () => {
    const distance = haversineDistanceM(
      ACADEMY.academyLat,
      ACADEMY.academyLng,
      ACADEMY.academyLat + 0.001,
      ACADEMY.academyLng,
    );
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(200);
  });

  it('detects guardian proxy check-ins', () => {
    expect(isGuardianProxyCheckIn('guardian-id', 'child-id')).toBe(true);
    expect(isGuardianProxyCheckIn('member-id', 'member-id')).toBe(false);
    expect(isGuardianProxyCheckIn(null, 'member-id')).toBe(false);
  });

  it('requires physical-presence confirmation for proxy check-in', () => {
    expect(
      requiresMinorPresenceConfirmation({
        callerUserId: 'guardian',
        targetUserId: 'child',
      }),
    ).toBe(true);

    expect(
      requiresMinorPresenceConfirmation({
        callerUserId: 'guardian',
        targetUserId: 'child',
        confirmMinorPresent: true,
      }),
    ).toBe(false);

    expect(
      requiresMinorPresenceConfirmation({
        callerUserId: 'member',
        targetUserId: 'member',
      }),
    ).toBe(false);
  });
});
