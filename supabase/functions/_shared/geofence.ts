import { MbError } from './errors.ts';

const EARTH_RADIUS_M = 6_371_000;

function requireEnvNumber(key: string): number {
  const raw = Deno.env.get(key);
  if (!raw) throw new MbError('UPSTREAM_ERROR', `Geofence not configured (${key}).`);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new MbError('UPSTREAM_ERROR', `Geofence not configured (${key}).`);
  }
  return value;
}

/** Great-circle distance in metres between two WGS-84 coordinates. */
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

export type GeofenceConfig = {
  academyLat: number;
  academyLng: number;
  radiusM: number;
};

export function readGeofenceConfig(): GeofenceConfig {
  return {
    academyLat: requireEnvNumber('ACADEMY_LAT'),
    academyLng: requireEnvNumber('ACADEMY_LNG'),
    radiusM: requireEnvNumber('GEOFENCE_RADIUS_M'),
  };
}

export type GeofenceCheckResult = {
  allowed: boolean;
  distanceM: number;
  radiusM: number;
};

export function checkGeofence(
  latitude: number,
  longitude: number,
  config = readGeofenceConfig(),
): GeofenceCheckResult {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new MbError('BAD_REQUEST', 'Valid GPS coordinates are required.');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new MbError('BAD_REQUEST', 'GPS coordinates are out of range.');
  }

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

export function assertWithinGeofence(latitude: number, longitude: number): void {
  const result = checkGeofence(latitude, longitude);
  if (!result.allowed) {
    throw new MbError(
      'OUTSIDE_GEOFENCE',
      'You must be at the academy to check in.',
    );
  }
}
