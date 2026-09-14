import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const previewUrl = 'http://127.0.0.1:3092';

export default defineConfig({
  ...base,
  testMatch: '**/seo.spec.ts',
  use: { ...base.use, baseURL: process.env.BASE_URL || previewUrl },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node scripts/preview-seo.mjs',
        url: previewUrl,
        timeout: 60_000,
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        env: { BGPOOF_SEO_PORT: '3092' },
      },
});
