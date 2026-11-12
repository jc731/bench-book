import pkg from '../package.json' with { type: 'json' };
import { expect, test, type Locator, type Page } from '@playwright/test';
import { downloadCsv } from './csv';

// Invented names only: the roster is personal data about minors.
const ROSTER = [
  { name: 'Player One', number: '4' },
  { name: 'Player Two', number: '00' },
  { name: 'Player Three', number: '0' },
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
  // What was typed on Setup survives a look at How to use and Back.
  await page.getByLabel('Opponent (required)').fill('Test Opp');
  await page.getByRole('button', { name: 'First time here? How to use' }).click();
  await expect(page.getByText(`v${pkg.version}`)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await expect(page.getByLabel('Opponent (required)')).toHaveValue('Test Opp');

  // Setup
  for (let i = 0; i < ROSTER.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    const n = i + 1;
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
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our points in Q1/).fill('3');
  await page.getByLabel(/Opponent points in Q1/).fill('5');
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /Check Q1 — not checked/ })).toHaveCount(0);

  // The book's opponent figure (5) now counts toward the opponent total.
  // Q2: score, end, leave unchecked
  await tap(page, card(page, '0', 'Player Three'), '+3');
  await expect(score(6, 5)).toBeVisible();
  await page.getByRole('button', { name: 'End Q2', exact: true }).click();
  await expect(page.getByText('Q3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check Q2 — not checked against the book' })).toBeVisible();

  // Q3: add then undo
  await tap(page, one, '+2');
  await expect(score(8, 5)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(score(6, 5)).toBeVisible();

  // Reload: state persisted, with a one-time note of where it left off. The undo history is gone.
  await page.reload();
  await expect(score(6, 5)).toBeVisible();
  // The line shows where it left off, beside the chip for the still-open Q2 check.
  await expect(page.getByTestId('feedback-text')).toHaveText('Last: #0 +3');
  await expect(page.getByRole('button', { name: 'Check Q2 — not checked against the book', exact: true })).toHaveText('Check Q2');
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Undo (history clears when the app reloads — fix plays in Log)' }),
  ).toBeDisabled();
  await expect(page.getByText('Q3', { exact: true })).toBeVisible();

  // Final / export opens Final without ending the game.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Final / export' }).click();
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
  await page.getByRole('button', { name: 'Back to game' }).click();
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
  await page.getByText('Game details', { exact: true }).click();
  await page.getByLabel('Also keep their score (Opp +1/+2/+3)').check();
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
  // "Also keep their score" is remembered from the first game.
  await page.getByText('Game details', { exact: true }).click();
  await expect(page.getByLabel('Also keep their score (Opp +1/+2/+3)')).toBeChecked();
  await page.getByLabel('Opponent (required)').fill('Second Opp');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByLabel('Score 0 to 0')).toBeVisible();
  await expect(page.getByText('Q1', { exact: true })).toBeVisible();
});

test('Clear saved roster: Cancel keeps it, Clear empties it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Clear Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await page.getByText('Game details', { exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Clear the saved roster from this device?' });
  await page.getByRole('button', { name: 'Clear saved roster' }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Player 1 name')).toHaveValue('Player One');

  await page.getByRole('button', { name: 'Clear saved roster' }).click();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Player 1 name')).toHaveValue('');
});

test('reconcile can add a play to a period that has none', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Add Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our points in Q1/).fill('2');
  await expect(page.getByTestId('compare')).not.toHaveText('✓ Matches');
  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
});

test('a long foul-out entry wraps whole beside the check chip and every card still fits', async ({ page }) => {
  const long = 'Player With A Very Long Nam'; // 27 characters
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Test Opp');
  await page.getByText('Game details', { exact: true }).click();
  await page.getByLabel('Also keep their score (Opp +1/+2/+3)').check();
  for (let i = 0; i < 7; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    await page.getByLabel(`Player ${i + 1} name`).fill(i === 0 ? long : `Player ${i + 1}`);
    await page.getByLabel(`Player ${i + 1} number`).fill(String(i + 10));
  }
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click(); // leaves Check Q1 pending
  await expect(page.getByRole('button', { name: /^Check Q1/ })).toBeVisible();
  const first = page.getByRole('button', { name: new RegExp(`^#10 ${long},`) });
  for (let i = 0; i < 5; i++) await tap(page, first, 'Foul');

  const entry = page.getByTestId('feedback-text');
  await expect(entry).toHaveText(`#10 ${long} foul — 5th, out — bonus`);
  expect(await entry.evaluate((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
  // It wrapped (taller than one text line), and the cards still fit above it.
  expect((await entry.boundingBox())!.height).toBeGreaterThan(24);
  const grid = page.getByTestId('player-grid');
  expect(await grid.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  const bench = (await page.getByRole('button', { name: 'Bench', exact: true }).boundingBox())!;
  expect(bench.y + bench.height).toBeLessThanOrEqual((await entry.boundingBox())!.y);
});

async function onePlayerGame(page: Page) {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Test Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
}

const stripPeriod = (page: Page, text: string) => page.getByRole('banner').getByText(text, { exact: true });
const endSlotButton = (page: Page, text: string) => page.getByRole('navigation').getByRole('button', { name: text, exact: true });
const notExportedChip = (page: Page) => page.getByRole('button', { name: /^Not exported/ });

/** Checks a quarter against a book that also reads 0, from wherever its Check button is. */
async function checkZero(page: Page, check: Locator, label: string) {
  await check.click();
  await page.getByLabel(new RegExp(`Our points in ${label}`)).fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

test('ended game: Final, reload, Reopen game', async ({ page }) => {
  await onePlayerGame(page);
  // Every quarter checked, so the only prompt left for an ended game is the not-exported one.
  for (const q of ['Q1', 'Q2', 'Q3']) {
    await page.getByRole('button', { name: `End ${q}`, exact: true }).click();
    await checkZero(page, page.getByRole('button', { name: `Check ${q} — not checked against the book` }), q);
  }
  await endSlotButton(page, 'End Q4…').click();
  await page.getByRole('dialog').getByRole('button', { name: 'End game (no overtime)' }).click();
  await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
  await checkZero(page, page.getByRole('region', { name: 'Open issues' }).getByRole('button', { name: 'Check', exact: true }), 'Q4');
  await page.getByRole('button', { name: 'Back to game' }).click();

  await expect(stripPeriod(page, 'Final')).toBeVisible();
  await expect(stripPeriod(page, 'Q4')).toHaveCount(0);
  // The ▸ shows but is not part of the name.
  await expect(endSlotButton(page, 'Final')).toHaveText('Final ▸');
  await expect(endSlotButton(page, 'Final')).toHaveAccessibleName('Final');
  await expect(page.getByText('Game ended', { exact: false })).toHaveCount(0);
  // The not-exported chip opens Final.
  await expect(notExportedChip(page)).toHaveText('Not exported');
  await notExportedChip(page).click();
  await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to game' }).click();

  // After a reload Undo is gone, but Final can still reopen the game.
  await page.reload();
  await expect(stripPeriod(page, 'Final')).toBeVisible();
  await expect(notExportedChip(page)).toBeVisible();
  await endSlotButton(page, 'Final').click();
  await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End game early' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reopen game' }).click();

  await expect(stripPeriod(page, 'Q4')).toBeVisible();
  await expect(stripPeriod(page, 'Final')).toHaveCount(0);
  await expect(endSlotButton(page, 'End Q4…')).toBeVisible();
  await expect(endSlotButton(page, 'Final')).toHaveCount(0);
  await expect(notExportedChip(page)).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Reopened game');
});

test('a live game: Final / export, then End game early with a confirm', async ({ page }) => {
  await onePlayerGame(page);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Final / export' }).click();
  await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen game' })).toHaveCount(0);

  await page.getByRole('button', { name: 'End game early' }).click();
  await expect(page.getByRole('dialog', { name: 'End the game now?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to game' }).click();
  await expect(stripPeriod(page, 'Q1')).toBeVisible();
  await expect(endSlotButton(page, 'End Q1')).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Final / export' }).click();
  await page.getByRole('button', { name: 'End game early' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End game', exact: true }).click();
  // It stays on Final, which now offers Reopen instead.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End game early' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Open issues' })).toContainText('Q1');
  await page.getByRole('button', { name: 'Back to game' }).click();
  await expect(stripPeriod(page, 'Final')).toBeVisible();
  await expect(endSlotButton(page, 'Final')).toBeVisible();
});

test('New game over an exported game: Exported ✓, and Discard is the primary button', async ({ page }) => {
  await onePlayerGame(page);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Final / export' }).click();
  await downloadCsv(page, page.getByRole('button', { name: 'Book CSV' }));
  await downloadCsv(page, page.getByRole('button', { name: 'Plays CSV' }));
  await page.getByRole('button', { name: 'New game' }).click();

  await expect(page.getByText(/A game is in progress \(vs Test Opp\)\.$/)).toBeVisible();
  await expect(page.getByText('Exported ✓', { exact: true })).toBeVisible();
  const buttons = page.getByRole('main').getByRole('button');
  await expect(buttons.first()).toHaveText('Discard and start new');
  await expect(buttons.first()).toHaveClass(/bg-amber-400/);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).not.toHaveClass(/bg-amber-400/);
});

test('a play added after both exports marks both files not saved again', async ({ page }) => {
  await onePlayerGame(page);
  const exportState = (kind: 'book' | 'plays') => page.getByTestId(`export-state-${kind}`);
  const openFinal = async () => {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Final / export' }).click();
  };
  const endEarly = async () => {
    await page.getByRole('button', { name: 'End game early' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End game', exact: true }).click();
  };
  const openCheck = (action = 'Check') =>
    page.getByRole('region', { name: 'Open issues' }).getByRole('button', { name: action, exact: true });

  // End with Q1 checked, so the only chip an ended game can show is the not-exported one.
  await openFinal();
  await endEarly();
  await checkZero(page, openCheck(), 'Q1');
  await downloadCsv(page, page.getByRole('button', { name: 'Book CSV' }));
  await downloadCsv(page, page.getByRole('button', { name: 'Plays CSV' }));
  await expect(exportState('book')).toHaveText('Book CSV ✓ saved');
  await expect(exportState('plays')).toHaveText('Plays CSV ✓ saved');
  await page.getByRole('button', { name: 'Back to game' }).click();
  await expect(stripPeriod(page, 'Final')).toBeVisible();
  await expect(notExportedChip(page)).toHaveCount(0);

  // Reopen and add a play: the saved files no longer hold the game.
  await endSlotButton(page, 'Final').click();
  await page.getByRole('button', { name: 'Reopen game' }).click();
  await tap(page, card(page, '4', 'Player One'), '+2');
  await openFinal();
  await expect(exportState('book')).toHaveText(/not saved/);
  await expect(exportState('plays')).toHaveText(/not saved/);
  await expect(exportState('book')).toHaveClass(/text-amber-300/);

  // End again, with Q1 matched to the book (it now reads a mismatch), and the chip is back.
  await endEarly();
  await openCheck('Reopen').click();
  await page.getByLabel(/Our points in Q1/).fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(exportState('plays')).toHaveText(/not saved/);
  await page.getByRole('button', { name: 'Back to game' }).click();
  await expect(notExportedChip(page)).toHaveText('Not exported');

  // And New game asks to export first.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText(/A game is in progress/)).toBeVisible();
  await expect(page.getByText('Exported ✓', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button').first()).toHaveText('Export');
});

test('the check screen scrolls its note and last row clear of the feedback line', async ({ page }) => {
  await onePlayerGame(page);
  await tap(page, card(page, '4', 'Player One'), '+2');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our points in Q1/).fill('5'); // a mismatch, so the plays list shows too
  await expect(page.getByTestId('feedback-text')).not.toHaveText('');

  const scroller = page.getByTestId('app-has').locator('..');
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const line = (await page.getByRole('status').filter({ has: page.getByTestId('feedback-text') }).boundingBox())!;
  const viewport = page.viewportSize()!;
  const note = (await page.getByRole('textbox', { name: 'Note' }).boundingBox())!;
  expect(note.y).toBeGreaterThanOrEqual(0);
  expect(note.y + note.height).toBeLessThanOrEqual(Math.min(line.y, viewport.height));
  const last = (await scroller.evaluate((el) => {
    const r = el.lastElementChild!.getBoundingClientRect();
    return r.bottom;
  }));
  expect(last).toBeLessThanOrEqual(line.y);
});

test('Log: newest first, tap to fix, Delete and Undo', async ({ page }) => {
  await onePlayerGame(page);
  const one = card(page, '4', 'Player One');
  await tap(page, one, '+2');
  await tap(page, one, 'Foul');
  await page.getByRole('navigation').getByRole('button', { name: 'Log', exact: true }).click();

  const q1 = page.getByRole('region', { name: 'Q1', exact: true });
  const rows = q1.getByRole('button');
  await expect(rows).toHaveCount(2);
  // The chevron is decoration: the name is the row text alone.
  await expect(rows.first()).toHaveAccessibleName('#4 Player One · Foul');
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One · +2');

  await rows.nth(1).click();
  const fix = page.getByRole('dialog');
  await expect(fix).toHaveAccessibleName('Fix: #4 +2 · Q1');
  await expect(fix.getByRole('group', { name: 'Play', exact: true })).toBeVisible();
  await expect(fix.getByRole('group', { name: 'Player', exact: true })).toBeVisible();
  await fix.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(fix).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Deleted #4 +2');
  await expect(rows).toHaveCount(1);

  await page.getByRole('status').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One · +2');
});

test("the check's Add-play sheet shows only what was added while it is open, and its list is oldest first", async ({ page }) => {
  await onePlayerGame(page);
  await tap(page, card(page, '4', 'Player One'), '+2');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our points in Q1/).fill('5');
  // An entry from before the sheet opens is on the check's own line...
  await expect(page.getByTestId('feedback-text')).not.toHaveText('');

  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  // ...but not inside the sheet.
  const status = page.getByRole('dialog').getByTestId('sheet-status');
  await expect(status).toHaveText('');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  // An FT keeps the sheet open, and what it added does show.
  await page.getByRole('dialog').getByRole('button', { name: 'FT made', exact: true }).click();
  await expect(status).toHaveText('Added #4 FT made to Q1');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  // The check's list stays oldest first, to walk beside the book.
  const rows = page.getByRole('region', { name: 'Plays to fix' }).getByRole('region', { name: 'Q1' }).getByRole('button');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAccessibleName('#4 Player One · +2');
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One · FT made');
});

test('Log: a fix that changes the player and the quarter, with the plays after it, is one Undo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Opponent (required)').fill('Test Opp');
  await page.getByLabel('Player 1 number').fill('4');
  await page.getByLabel('Player 1 name').fill('Player One');
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByLabel('Player 2 number').fill('00');
  await page.getByLabel('Player 2 name').fill('Player Two');
  await page.getByRole('button', { name: 'Start game' }).click();
  const one = card(page, '4', 'Player One');
  await tap(page, one, '+2');
  await tap(page, one, 'Foul');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Log', exact: true }).click();

  const q1 = page.getByRole('region', { name: 'Q1', exact: true });
  const q2 = page.getByRole('region', { name: 'Q2', exact: true });
  await q1.getByRole('button', { name: /^#4 Player One · \+2/ }).click();
  const fix = page.getByRole('dialog');
  const quarter = fix.getByRole('group', { name: 'Quarter', exact: true });
  const also = fix.getByRole('checkbox', { name: 'Also move the 1 play after it in Q1', exact: true });
  await expect(also).toHaveCount(0);
  await quarter.getByRole('button', { name: 'Q2', exact: true }).click();
  await also.check();
  // Back to its own quarter, the box goes and the tick with it.
  await quarter.getByRole('button', { name: 'Q1', exact: true }).click();
  await expect(also).toHaveCount(0);
  await quarter.getByRole('button', { name: 'Q2', exact: true }).click();
  await expect(also).not.toBeChecked();
  await also.check();
  await fix.getByRole('group', { name: 'Player', exact: true }).getByRole('button', { name: '#00 Player Two', exact: true }).click();
  await fix.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByTestId('feedback-text')).toHaveText('Edited #4 +2 → #00 +2; moved 2 plays to Q2');
  await expect(q1).toHaveCount(0);
  await expect(q2.getByRole('listitem')).toHaveCount(2);
  await expect(q2.getByRole('button', { name: /^#00 Player Two · \+2/ })).toBeVisible();

  // One Undo restores both the player and the quarter.
  await page.getByRole('status').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(q2).toHaveCount(0);
  await expect(q1.getByRole('listitem')).toHaveCount(2);
  await expect(q1.getByRole('button', { name: '#4 Player One · +2', exact: true })).toBeVisible();
  await expect(q1.getByRole('button', { name: '#4 Player One · Foul', exact: true })).toBeVisible();
});
