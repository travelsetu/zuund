/** Where the product lives. Every sign-in / sign-up link on the marketing site goes there. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.zuund.com').replace(
  /\/$/,
  '',
);

export const appLink = (path = '/') => `${APP_URL}${path}`;
export const SUPPORT_EMAIL = 'support@zuund.com';
