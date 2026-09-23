import { Platform, useWindowDimensions } from 'react-native';

/** Desktop browsers get the sidebar layout; phones, tablets-in-app and narrow windows keep the tab bar. */
export const DESKTOP_MIN_WIDTH = 1024;
/** Reading column for page content on desktop. */
export const CONTENT_MAX_WIDTH = 760;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
