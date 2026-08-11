import type { Href } from 'expo-router';

export function getDefaultHomeRoute(role: string | null | undefined): Href {
  if (role === 'coach' || role === 'admin') {
    return '/(coach)/(main)';
  }
  return '/(tabs)';
}
