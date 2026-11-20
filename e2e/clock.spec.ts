import { expect, test, type Page } from '@playwright/test';
import { OPPONENT, TEAM, ui } from './fixture';

/*
 * Task 6: the Experiments page and the timeout clock (design 2026-11-19, D15-D21, I7-I9). Invented
 * names only; nothing here imports from src/. The page's clock is Playwright's fake clock, installed
 * before load, so every time below is exact.
 */
declare const process: { env: Record<string, string | undefined> };
const exact = (name: string) => ({ name, exact: true });
const band = (page: Page) => page.getByRole('timer', exact('Timeout clock'));
const savedGame = (page: Page) => page.evaluate(() => localStorage.getItem('benchbook:game'));

async function startGame(page: Page) {
  await page.clock.install({ time: new Date('2026-11-19T18:00:00') });
  await page.goto('/');
  const app = ui(page);
  await app.fillSetup(OPPONENT, TEAM);
  await app.startGame();
  return app;
}

async function turnClockOn(page: Page) {
  await page.getByRole('navigation').getByRole('button', exact('More')).click();
  await page.getByRole('dialog').getByRole('button', exact('Experiments')).click();
  await expect(page.getByRole('heading', exact('Experiments'))).toBeVisible();
  const toggle = page.getByRole('switch', exact('Timeout clock'));
  await expect(toggle).toHaveAttribute('aria-checked', 'false'); // D15: off by default
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', exact('Back')).click();
}

test('I9: with the experiment off (the default), a timeout opens no clock', async ({ page }) => {
  const app = await startGame(page);
  await app.timeout('30s');
  await expect(page.getByTestId('feedback-text')).toHaveText('Home timeout (30s)');
  await expect(band(page)).toHaveCount(0);
});

test('timeout clock: opt in, a 30 counts down across views, warns at halfway, Time at 0, × closes (D15-D21, I7)', async ({ page }) => {
  const app = await startGame(page);
  await turnClockOn(page);

  // D16: a 30 opens a 30 s clock. D17: it doesn't start by itself, and it takes the feedback line's place.
  await app.timeout('30s');
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:30');
  await expect(page.getByTestId('feedback-text')).toHaveCount(0);
  // D17: nothing is blocked: a card still opens its play sheet.
  await app.card('Player One').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', exact('Done')).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // D21: undoing the timeout leaves the clock alone.
  const beforeUndo = await savedGame(page);
  await app.undo();
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:30');
  await expect.poll(() => savedGame(page)).not.toBe(beforeUndo); // the Undo itself did change the game
  await app.timeout('30s'); // take it again, as the game had it

  // I7: nothing the clock does writes to the game.
  const before = await savedGame(page);
  await band(page).getByRole('button', exact('Start')).click();
  await page.clock.runFor(15_000);
  // D19: halfway on a 30 is 15 s, with the note.
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:15');
  await expect(band(page).getByTestId('clock-note')).toHaveText('15 seconds');

  // D18 / Review Focus 4: it keeps falling while the scorer is on the Log.
  await page.getByRole('navigation').getByRole('button', exact('Log')).click();
  await expect(band(page)).toHaveCount(0); // D18: it shows on Live only
  await page.clock.runFor(5_000);
  await page.getByRole('button', exact('Back')).click();
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:10');

  // Pause holds the time; Reset gives the full 30 back, not running (D17).
  await band(page).getByRole('button', exact('Pause')).click();
  await page.clock.runFor(4_000);
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:10');
  await band(page).getByRole('button', exact('Reset')).click();
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:30');
  await page.clock.runFor(4_000);
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:30');

  // D19: past 0 it reads Time and stays at 0:00 (I8).
  await band(page).getByRole('button', exact('Start')).click();
  await page.clock.runFor(31_000);
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:00');
  await expect(band(page).getByTestId('clock-note')).toHaveText('Time');

  // × closes it and the feedback line is back with the last entry.
  await band(page).getByRole('button', exact('Close clock')).click();
  await expect(band(page)).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Home timeout (30s)');
  expect(await savedGame(page)).toBe(before); // I7: Start, Pause, Reset and × left the saved game as it was
});

test('a full timeout opens a 60 s clock that warns at 30 s; the band fits one row on 10 a side (D16, D17, D19)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-19T18:00:00') });
  await page.goto('/');
  for (let i = 0; i < 10; i++) {
    if (i > 0) await page.getByRole('button', exact('Add player')).click();
    await page.getByLabel(`Player ${i + 1} number`, { exact: true }).fill(String(10 + i));
    await page.getByLabel(`Player ${i + 1} name`, { exact: true }).fill(`Player ${i + 1}`);
  }
  const app = ui(page);
  await app.fillOppRoster(Array.from({ length: 10 }, (_, i) => ({ number: String(50 + i) })));
  await page.getByRole('button', exact('Start game')).click();
  await turnClockOn(page);

  await app.timeout('Full', 'Away');
  await expect(band(page).getByTestId('clock-time')).toHaveText('1:00');
  await band(page).getByRole('button', exact('Start')).click();
  await page.clock.runFor(29_000);
  await expect(band(page).getByTestId('clock-note')).toHaveText('');
  await page.clock.runFor(1_000);
  await expect(band(page).getByTestId('clock-time')).toHaveText('0:30');
  await expect(band(page).getByTestId('clock-note')).toHaveText('30 seconds');

  // One row, at most 56 px tall; buttons at least 44 px (constraints); no card, Sub or + Play under it.
  const b = (await band(page).boundingBox())!;
  expect(b.height).toBeLessThanOrEqual(56);
  for (const name of ['Pause', 'Reset', 'Close clock']) {
    const btn = (await band(page).getByRole('button', exact(name)).boundingBox())!;
    expect(btn.height).toBeGreaterThanOrEqual(44);
    expect(btn.width).toBeGreaterThanOrEqual(44);
  }
  for (const side of ['Home', 'Away'] as const) {
    expect(await app.half(side).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    const h = (await app.half(side).boundingBox())!;
    expect(h.y + h.height).toBeLessThanOrEqual(b.y);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // For a look at the band in warn: CLOCK_SHOT=<path> pnpm test:e2e clock.
  if (process.env.CLOCK_SHOT) await page.screenshot({ path: process.env.CLOCK_SHOT });
});
