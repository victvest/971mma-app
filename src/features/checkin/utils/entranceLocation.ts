import Constants from 'expo-constants';
import * as Location from 'expo-location';

const LOCATION_TIMEOUT_MS = 8_000;

export class LocationPermissionError extends Error {
  constructor() {
    super('Location access is required to verify you are at the academy.');
    this.name = 'LocationPermissionError';
  }
}

export class LocationTimeoutError extends Error {
  constructor() {
    super('Could not determine your location. Try again near the entrance.');
    this.name = 'LocationTimeoutError';
  }
}

function readDevCoordinate(key: 'DEV_GATE_LAT' | 'DEV_GATE_LNG'): number | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const raw = extra[key] ?? process.env[`EXPO_PUBLIC_${key}`];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Foreground GPS for entrance check-in; optional dev override for simulator testing. */
export async function readEntranceCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (__DEV__) {
    const lat = readDevCoordinate('DEV_GATE_LAT');
    const lng = readDevCoordinate('DEV_GATE_LNG');
    if (lat !== null && lng !== null) {
      return { latitude: lat, longitude: lng };
    }
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError();
  }

  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new LocationTimeoutError()), LOCATION_TIMEOUT_MS);
    }),
  ]);

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
