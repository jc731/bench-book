import { expect, test } from '@playwright/test';
import { ui } from './fixture';

/*
 * Demo mode (`?demo`): its own storage keys, a gray "Demo" marker, a Reset in More. Nothing here
 * imports from src/; the key names are written out so a rename in src/ fails this spec.
 */

const now = new Date().toISOString();
const REAL_GAME = {
  version: 1, id: 'real-game', currentPeriod: 1, periods: [], trackOpponentTaps: false, createdAt: now, updatedAt: now,
  info: { team: 'Real Team', opponent: 'Real Opp', date: now.slice(0, 10), homeAway: 'home', coach: '', scorer: '', timer: '' },
  roster: [{ id: 'r1', number: '9', name: 'Real Player', pos: '' }],
  oppRoster: [],
  events: [],
};
const REAL_ROSTER = [{ id: 'r1', number: '9', name: 'Real Player', pos: '' }];

/** Seeds the real keys once per test (not on every navigation), and returns their exact strings. */
async function seedReal(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(([g, r]) => {
    localStorage.clear();
    localStorage.setItem('benchbook:game', g!);
    localStorage.setItem('benchbook:roster', r!);
  }, [JSON.stringify(REAL_GAME), JSON.stringify(REAL_ROSTER)]);
  return { game: JSON.stringify(REAL_GAME), roster: JSON.stringify(REAL_ROSTER) };
}
const read = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({ game: localStorage.getItem('benchbook:game'), roster: localStorage.getItem('benchbook:roster') }));

test('?demo opens Setup with both demo rosters, shows the Demo marker on every screen, and never touches the real keys', async ({ page }) => {
  const real = await seedReal(page);

  await page.goto('/?demo');
  // The real game in progress is NOT shown: demo opens on Setup with both rosters filled.
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await expect(page.getByLabel('Player 8 name', { exact: true })).toHaveValue(/.+/);
  await expect(page.getByLabel('Their player 8 name', { exact: true })).toHaveValue(/.+/);
  const marker = page.getByText('Demo', { exact: true });
  await expect(marker).toBeVisible();

  await page.getByText('Game details').click();
  await expect(page.getByLabel(/^Our team/)).toHaveValue(/.+/);
  await expect(page.getByLabel(/^Opponent/)).toHaveValue(/.+/);

  await ui(page).startGame();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(marker).toBeVisible();
  // Play something.
  await page.getByRole('button', { name: /^#3 Sam Rivera,/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(marker).toBeVisible();
  for (const view of ['Log', 'More']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(marker).toBeVisible();
    if (view === 'Log') await page.getByRole('button', { name: /^Back|Live/ }).first().click();
  }

  // A reload keeps the address: the demo game resumes like a real one.
  await page.reload();
  await expect(page.getByRole('banner').getByLabel('Score Home 2, Away 0')).toBeVisible();
  await expect(marker).toBeVisible();

  expect(await read(page)).toEqual(real);
  const demoKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('benchbook-demo:')).sort());
  expect(demoKeys).toEqual(['benchbook-demo:game', 'benchbook-demo:roster']);

  // Without ?demo the real game is still there, with no marker.
  await page.goto('/');
  await expect(page.getByText('Real Opp').or(page.getByRole('banner'))).toBeVisible();
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^#9 Real Player,/ })).toBeVisible();
  expect(await read(page)).toEqual(real);
});

test('Reset demo clears the demo game and refills the rosters', async ({ page }) => {
  const real = await seedReal(page);
  await page.goto('/?demo');
  // Edit the roster, start, then reset.
  await page.getByLabel('Player 1 name', { exact: true }).fill('Edited Name');
  await ui(page).startGame();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(await page.evaluate(() => localStorage.getItem('benchbook-demo:game'))).not.toBeNull();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await expect(page.getByLabel('Player 1 name', { exact: true })).toHaveValue('Sam Rivera');
  await expect(page.getByLabel('Their player 8 name', { exact: true })).toHaveValue(/.+/);
  expect(await page.evaluate(() => localStorage.getItem('benchbook-demo:game'))).toBeNull();
  expect(await read(page)).toEqual(real);
});

test('a real game has no Reset demo and no Demo marker', async ({ page }) => {
  await seedReal(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Reset demo' })).toHaveCount(0);
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
});
