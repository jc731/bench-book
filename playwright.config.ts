import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };
const PORT = Number(process.env.E2E_PORT) || 4400;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  projects: [{ name: 'iphone-13' }],
  webServer: {
    command: `pnpm build && pnpm exec astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
