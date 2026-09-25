/** Where the product lives. Every sign-in / sign-up link on the marketing site goes there. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.zuund.com').replace(
  /\/$/,
  '',
);

export const appLink = (path = '/') => `${APP_URL}${path}`;
export const SUPPORT_EMAIL = 'support@zuund.com';

/** Straight into a Buying Post for one model, size or destination (after signing in or up). */
export const appPostLink = (item: {
  id: string;
  displayName: string;
  category: string;
  segment: string | null;
}) =>
  appLink(
    `/posts/new?${new URLSearchParams({
      carId: item.id,
      name: item.displayName,
      category: item.category,
      segment: item.segment ?? '',
    })}`,
  );

/** The app's picker for a category, optionally opened at a brand or trip type. */
export const appSearchLink = (category: string, brand?: string) =>
  appLink(`/search?${new URLSearchParams(brand ? { category, brand } : { category })}`);
