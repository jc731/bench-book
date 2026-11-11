import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// `pnpm howto:shots`: the How-to screenshots. A separate config so `pnpm test:e2e` never runs it.
export default defineConfig({
  ...base,
  testDir: 'scripts/howto',
  use: { ...base.use, deviceScaleFactor: 2 },
});
