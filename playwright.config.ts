import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

process.env.BGPOOF_TEST_GA_ID ??=
  loadEnv('production', process.cwd(), 'VITE_BGPOOF_').VITE_BGPOOF_GA_ID || '';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3090',
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--no-sandbox'] },
  },
  reporter: 'list',
});
