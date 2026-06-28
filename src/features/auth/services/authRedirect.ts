import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function getAuthRedirectPath(platform = Platform.OS): string {
  return platform === 'web' ? '/' : 'auth/callback';
}

export function getAuthRedirectUri(): string {
  return Linking.createURL(getAuthRedirectPath());
}
