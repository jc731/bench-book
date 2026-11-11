import pkg from '../package.json' with { type: 'json' };
import { expect, test, type Locator, type Page } from '@playwright/test';
import { downloadCsv } from './csv';

// Invented names only: the roster is personal data about minors.
const ROSTER = [
  { pos: 'G', name: 'Player One', number: '4' },
  { pos: 'F', name: 'Player Two', number: '00' },
  { pos: 'C', name: 'Player Three', number: '0' },
];

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= 390);

const card = (page: Page, number: string, name: string) =>
  page.getByRole('button', { name: new RegExp(`^#${number} ${name},`) });

async function tap(page: Page, who: Locator, ...labels: string[]) {
  await who.click();
  const sheet = page.getByRole('dialog');
  for (const l of labels) await sheet.getByRole('button', { name: l, exact: true }).click();
  // +2, +3, Foul and Tech foul close the sheet on their own; FT made and FT missed keep it open.
  const done = sheet.getByRole('button', { name: 'Done', exact: true });
  if (await done.isVisible()) await done.click();
  await expect(sheet).toHaveCount(0);
}

test('scripted game reconciles and exports', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(`v${pkg.version}`)).toBeVisible();

  // Setup
  await page.getByLabel('Opponent (required)').fill('Test Opp');
  for (let i = 0; i < ROSTER.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    const n = i + 1;
    await page.getByLabel(`Player ${n} position`).fill(ROSTER[i].pos);
    await page.getByLabel(`Player ${n} name`).fill(ROSTER[i].name);
    await page.getByLabel(`Player ${n} number`).fill(ROSTER[i].number);
  }
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: 'Start game' }).click();

  // Live, Q1
  const score = (us: number, opp: number) => page.getByLabel(`Score ${us} to ${opp}`);
  await expect(score(0, 0)).toBeVisible();
  await expect(page.getByText('Q1', { exact: true })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);

  const one = card(page, '4', 'Player One');
  await tap(page, one, '+2');
  await tap(page, card(page, '00', 'Player Two'), 'FT made');
  await expect(score(3, 0)).toBeVisible();
  await expect(one).toHaveClass(/border-slate-600/);
  for (let i = 0; i < 4; i++) await tap(page, one, 'Foul');
  await expect(one).toHaveAccessibleName(/4 fouls/);
  await expect(one).toHaveClass(/border-amber-400/);
  await expect(one).not.toHaveClass(/border-red-500/);

  // End Q1, reconcile 3 / 5
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await expect(page.getByText('Q2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Q1 not checked against the book — Check' }).click();
  await page.getByLabel(/Our points in Q1/).fill('3');
  await page.getByLabel(/Opponent points in Q1/).fill('5');
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /Q1 not checked/ })).toHaveCount(0);

  // The book's opponent figure (5) now counts toward the opponent total.
  // Q2: score, end, leave unchecked
  await tap(page, card(page, '0', 'Player Three'), '+3');
  await expect(score(6, 5)).toBeVisible();
  await page.getByRole('button', { name: 'End Q2', exact: true }).click();
  await expect(page.getByText('Q3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Q2 not checked against the book — Check' })).toBeVisible();

  // Q3: add then undo
  await tap(page, one, '+2');
  await expect(score(8, 5)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(score(6, 5)).toBeVisible();

  // Reload: state persisted, with a one-time note of where it left off. The undo history is gone.
  await page.reload();
  await expect(score(6, 5)).toBeVisible();
  // Live's line leads with the open Q2 check, which outranks the entry; Log's line shows where it left off.
  await expect(page.getByTestId('feedback-text')).toHaveText('Q2 not checked against the book — Check');
  await page.getByRole('navigation').getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByTestId('feedback-text')).toHaveText('Last: #0 +3');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Undo (history clears when the app reloads — fix plays in Log)' }),
  ).toBeDisabled();
  await expect(page.getByText('Q3', { exact: true })).toBeVisible();

  // End game / export
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'End game / export' }).click();
  const issues = page.getByRole('region', { name: 'Open issues' });
  await expect(issues).toContainText('Q2');
  await expect(issues).not.toContainText('Q1');

  const rows = await downloadCsv(page, page.getByRole('button', { name: 'Book CSV' }));
  expect(rows.some((r) => r.includes('#00'))).toBe(true);
  const start = rows.findIndex((r) => r[0] === 'Reconcile');
  expect(start).toBeGreaterThan(-1);
  const block = rows.slice(start + 2);
  const q2 = block.find((r) => r[0] === 'Q2');
  expect(q2?.[4]).toBe('pending');
  expect(block.find((r) => r[0] === 'Q1')?.[4]).toBe('matched');

  // A second game from the same device: New game -> discard -> roster prefilled -> 0-0.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText(/A game is in progress/)).toBeVisible();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.getByLabel('Player 3 name')).toHaveValue('Player Three');
  await page.getByLabel('Opponent (required)').fill('Second Opp');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(score(0, 0)).toBeVisible();
});

test('a second game: Live menu -> New game -> discard -> roster prefilled -> 0-0', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('First Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page, card(page, '4', 'Player One'), '+2');
  await expect(page.getByLabel('Score 2 to 0')).toBeVisible();

  // Cancel returns to Live with the game intact.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText(/A game is in progress \(vs First Opp\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Score 2 to 0')).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.getByLabel('Player 1 name')).toHaveValue('Player One');
  await page.getByLabel('Opponent (required)').fill('Second Opp');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByLabel('Score 0 to 0')).toBeVisible();
  await expect(page.getByText('Q1', { exact: true })).toBeVisible();
});

test('reconcile can add a play to a period that has none', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Add Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Q1 not checked against the book — Check' }).click();
  await page.getByLabel(/Our points in Q1/).fill('2');
  await expect(page.getByTestId('compare')).not.toHaveText('✓ Matches');
  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
});
