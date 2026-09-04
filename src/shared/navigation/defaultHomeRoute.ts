import type { Href } from 'expo-router';

export function getDefaultHomeRoute(role: string | null | undefined): Href {
  if (role === 'coach') {
    return '/(coach)/(main)';
  }
  return '/(tabs)';
}
