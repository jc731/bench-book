import { describe, expect, it } from 'vitest';

// Empty when dist/ has not been built, so a clean checkout still passes `pnpm check`.
const built = import.meta.glob<string>('../../dist/sw.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const text = Object.values(built)[0];

describe('service worker', () => {
  it.skipIf(text === undefined)(
    'precaches the page (index.html) under "/" (skipped: dist/sw.js absent, run `pnpm build` first)',
    () => {
      // the page itself is precached under its directory URL
      expect(text).toMatch(/url:[`'"]\/[`'"]/);
    },
  );
  it.skipIf(text === undefined)(
    'precaches the three How-to screenshots, since Workbox skips any file over 2 MiB (skipped: dist/sw.js absent, run `pnpm build` first; a stale dist/ gives a false red, which `pnpm build` fixes)',
    () => {
      for (const f of ['reading-the-screen', 'mistakes', 'end-of-quarter']) expect(text).toContain(`howto/${f}.png`);
    },
  );
});
