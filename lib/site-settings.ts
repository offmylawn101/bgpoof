// VITE_ settings are public, build-time values. Never put credentials here.
export const siteUrl =
  import.meta.env.VITE_BGPOOF_SITE_URL || 'http://localhost:3090';

const configuredAnalyticsId = import.meta.env.VITE_BGPOOF_GA_ID || '';
export const analyticsId = /^G-[A-Z0-9]+$/.test(configuredAnalyticsId)
  ? configuredAnalyticsId
  : '';
export const webAnalyticsEnabled =
  import.meta.env.VITE_BGPOOF_WEB_ANALYTICS === 'true';
