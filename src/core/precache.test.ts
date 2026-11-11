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
    'precaches index.html (skipped: dist/sw.js absent, run `pnpm build` first)',
    () => {
      expect(text).toContain('index.html');
      // the page itself is precached under its directory URL
      expect(text).toMatch(/url:[`'"]\/[`'"]/);
    },
  );
});
