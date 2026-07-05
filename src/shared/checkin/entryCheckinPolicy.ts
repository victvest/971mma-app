/** Pure entry-checkin helpers — mirrored by entry-checkin Edge Function. */

const EARTH_RADIUS_M = 6_371_000;

export type GeofenceConfig = {
  academyLat: number;
  academyLng: number;
  radiusM: number;
};

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function checkGeofence(
  latitude: number,
  longitude: number,
  config: GeofenceConfig,
): { allowed: boolean; distanceM: number; radiusM: number } {
  const distanceM = haversineDistanceM(
    latitude,
    longitude,
    config.academyLat,
    config.academyLng,
  );

  return {
    allowed: distanceM <= config.radiusM,
    distanceM: Math.round(distanceM),
    radiusM: config.radiusM,
  };
}

export function isGuardianProxyCheckIn(
  presentedBy: string | null,
  memberId: string,
): boolean {
  return Boolean(presentedBy && presentedBy !== memberId);
}

export function requiresMinorPresenceConfirmation(params: {
  callerUserId: string;
  targetUserId: string;
  confirmMinorPresent?: boolean;
}): boolean {
  if (params.targetUserId === params.callerUserId) return false;
  return params.confirmMinorPresent !== true;
}
