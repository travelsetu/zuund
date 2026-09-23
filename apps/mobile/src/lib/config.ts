import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API origin. EXPO_PUBLIC_API_URL wins; in development we reuse the host the
 * Expo dev server is reachable on (this Mac's LAN IP) with the API's port.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  // In a browser, talk to the API on the page's own hostname: localhost page + LAN-IP API
  // would be cross-site, and the sign-in cookies would not be sent.
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (__DEV__ && host) return `http://${host}:3000`;
  return 'https://api.zuund.com';
}

export const API_URL = resolveApiUrl();
export const SUPPORT_EMAIL = 'support@zuund.com';
