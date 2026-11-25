import { expect, test, type Page } from '@playwright/test';
import { ui } from './fixture';

// Design: docs/superpowers/specs/2026-11-25-earlier-quarter-checks-design.md (the numbered invariants).

async function onePlayerGame(page: Page) {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
}

const saved = (page: Page) => page.evaluate(() => localStorage.getItem('benchbook:game'));
const more = (page: Page) => page.getByRole('navigation').getByRole('button', { name: 'More', exact: true }).click();

test('tabs: opening one changes nothing saved, and a typed score survives the round trip (invariants 1, 2)', async ({ page }) => {
  await onePlayerGame(page);
  const u = ui(page);
  await u.endPeriod('Q1');
  await u.endPeriod('Q2');
  await more(page);
  await page.getByRole('button', { name: 'Quarter checks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check Q2' })).toBeVisible();
  await page.getByLabel(/Our game score after Q2/).fill('18');
  const before = await saved(page);
  await page.getByRole('button', { name: 'Q1, Not checked', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check Q1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Q1, Not checked', exact: true })).toHaveAttribute('aria-current', 'page');
  // Invariant 1: the saved game is byte-for-byte what it was (the draft is not part of a saved check).
  // The kept draft (checkDrafts) is deliberately written by a tab, as Later writes it; everything else, periods and
  // every check's status included, must be untouched.
  const strip = (s: string | null) => { const g = JSON.parse(s!); delete g.checkDrafts; delete g.updatedAt; return g; };
  expect(strip(await saved(page))).toEqual(strip(before));
  await page.getByRole('button', { name: 'Q2, Not checked', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check Q2' })).toBeVisible();
  await expect(page.getByLabel(/Our game score after Q2/)).toHaveValue('18');
});

test('More: Quarter checks is absent before End Q1, present after, and opens Q1 (invariant 4)', async ({ page }) => {
  await onePlayerGame(page);
  await more(page);
  await expect(page.getByRole('button', { name: 'Quarter checks', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ui(page).endPeriod('Q1');
  await more(page);
  await page.getByRole('button', { name: 'Quarter checks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check Q1' })).toBeVisible();
});

test("the Q1 table row reads the quarter's points, fouls and the game's fouls (invariant 3)", async ({ page }) => {
  await onePlayerGame(page);
  const u = ui(page);
  await u.score('Player One', '+2');
  await u.foul('Player One');
  await u.endPeriod('Q1');
  await u.banner('Q1').click();
  // Source: 2 points and 1 foul entered in Q1 above; the game total is the same one foul.
  await expect(page.getByRole('table', { name: 'Players in Q1' }).getByRole('row', { name: /#4 Player One/ }).getByRole('cell')).toHaveText(['2', '1', '1']);
  await expect(page.getByText(/^Team fouls in Q1:/)).toHaveText('Team fouls in Q1: 1');
});
