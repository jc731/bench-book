import pkg from '../package.json' with { type: 'json' };
import { expect, test, type Locator, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { colorContrast, contrast, ui, type Side } from './fixture';

// Invented names only: the roster is personal data about minors.
const ROSTER = [
  { name: 'Player One', number: '4' },
  { name: 'Player Two', number: '00' },
  { name: 'Player Three', number: '0' },
];

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= 390);

/** A player's number area (1.1 rows show no names; `name` documents who the number is). */
const card = (page: Page, number: string, _name: string) =>
  page.getByRole('button', { name: new RegExp(`^#${number},`) });

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
  await page.getByText('Game details', { exact: true }).click();
  await page.getByLabel('Opponent (optional)').fill('Test Opp');
  await page.getByRole('button', { name: 'First time here? How to use' }).click();
  await expect(page.getByText(`v${pkg.version}`)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await expect(page.getByLabel('Opponent (optional)')).toHaveValue('Test Opp');

  // Setup
  for (let i = 0; i < ROSTER.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    const n = i + 1;
    await page.getByLabel(`Player ${n} name`, { exact: true }).fill(ROSTER[i].name);
    await page.getByLabel(`Player ${n} number`, { exact: true }).fill(ROSTER[i].number);
  }
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: 'Start game' }).click();

  // Live, Q1
  const score = (us: number, opp: number) => page.getByLabel(`Score Home ${us}, Away ${opp}`);
  await expect(score(0, 0)).toBeVisible();
  await expect(page.getByText('Q1', { exact: true })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);

  const one = card(page, '4', 'Player One');
  await tap(page, one, '+2');
  await tap(page, card(page, '00', 'Player Two'), 'FT made');
  await expect(score(3, 0)).toBeVisible();
  // 1.1: a row's state is its inset ring (spec "The row"); the number area sits inside the row.
  const oneRow = one.locator('..');
  await expect(oneRow).not.toHaveClass(/ring-(amber|red)-/); // the plain row: no ring
  for (let i = 0; i < 4; i++) await tap(page, one, 'Foul');
  await expect(one).toHaveAccessibleName(/4 fouls/);
  await expect(oneRow).toHaveClass(/ring-amber-600/);
  await expect(oneRow).not.toHaveClass(/ring-red-600/);

  // End Q1, reconcile 3 / 5
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await expect(page.getByText('Q2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our game score after Q1/).fill('3');
  await page.getByLabel(/Their game score after Q1/).fill('5');
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
  await expect(page.getByTestId('feedback-text')).toHaveText('Last: #0 (Home) +3');
  await expect(page.getByRole('button', { name: 'Check Q2 — not checked against the book', exact: true })).toHaveText('Check Q2');
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Undo (history clears when the app reloads — fix plays in Book)' }),
  ).toBeDisabled();
  await expect(page.getByText('Q3', { exact: true })).toBeVisible();

  // Final / export opens Final without ending the game.
  await page.getByRole('button', { name: 'More', exact: true }).click();
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
  expect(q2?.[7]).toBe('pending'); // Status sits after Book total, App total, Compared, Book, App, Diff
  expect(block.find((r) => r[0] === 'Q1')?.[7]).toBe('matched');

  // A second game from the same device: New game -> discard -> roster prefilled -> 0-0.
  await page.getByRole('button', { name: 'Back to game' }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText(/A game is in progress/)).toBeVisible();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.getByLabel('Player 3 name', { exact: true })).toHaveValue('Player Three');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(score(0, 0)).toBeVisible();
});

test('a second game: Live menu -> New game -> discard -> roster prefilled -> 0-0', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Game details', { exact: true }).click();
  await page.getByLabel('Opponent (optional)').fill('First Opp');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page, card(page, '4', 'Player One'), '+2');
  await expect(page.getByLabel('Score Home 2, Away 0')).toBeVisible();

  // Cancel returns to Live with the game intact.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText(/A game is in progress \(vs First Opp\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Score Home 2, Away 0')).toBeVisible();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.getByLabel('Player 1 name', { exact: true })).toHaveValue('Player One');
  await page.getByText('Game details', { exact: true }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByLabel('Score Home 0, Away 0')).toBeVisible();
  await expect(page.getByText('Q1', { exact: true })).toBeVisible();
});

test('Clear saved roster: Cancel keeps it, Clear empties it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await page.getByText('Game details', { exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Clear the saved roster from this device?' });
  await page.getByRole('button', { name: 'Clear saved roster' }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Player 1 name', { exact: true })).toHaveValue('Player One');

  await page.getByRole('button', { name: 'Clear saved roster' }).click();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Player 1 name', { exact: true })).toHaveValue('');
});

test('reconcile can add a play to a period that has none', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our game score after Q1/).fill('2');
  await expect(page.getByTestId('compare')).not.toHaveText('✓ Matches');
  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
});

test('check: Add play stays available after the score matches', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our game score after Q1/).fill('0');
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
  const teamFouls = page.getByText(/^Team fouls in Q1:/);
  await expect(teamFouls).toHaveText('Team fouls in Q1: 0');
  const region = page.getByRole('region', { name: 'Plays to fix', exact: true });
  await region.getByRole('button', { name: 'Add play to Q1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Foul', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(teamFouls).toHaveText('Team fouls in Q1: 1');
  await expect(page.getByTestId('compare')).toHaveText('✓ Matches');
});

test('a long foul-out entry wraps whole beside the check chip and every card still fits', async ({ page }) => {
  const long = 'Player With A Very Long Nam'; // 27 characters
  await page.goto('/');
  await page.getByText('Game details', { exact: true }).click();
  for (let i = 0; i < 7; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    await page.getByLabel(`Player ${i + 1} name`, { exact: true }).fill(i === 0 ? long : `Player ${i + 1}`);
    await page.getByLabel(`Player ${i + 1} number`, { exact: true }).fill(String(i + 10));
  }
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('button', { name: 'End Q1', exact: true }).click(); // leaves Check Q1 pending
  await expect(page.getByRole('button', { name: /^Check Q1/ })).toBeVisible();
  const first = page.getByRole('button', { name: /^#10,/ });
  for (let i = 0; i < 5; i++) await tap(page, first, 'Foul');

  const entry = page.getByTestId('feedback-text');
  await expect(entry).toHaveText(`#10 ${long} (Home) out, 5 fouls — bonus. Tell the official.`);
  expect(await entry.evaluate((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
  // It wrapped (taller than one text line), and both halves still fit above it.
  expect((await entry.boundingBox())!.height).toBeGreaterThan(24);
  await ui(page).expectControlsInView();
});

async function onePlayerGame(page: Page) {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Start game' }).click();
}

const stripPeriod = (page: Page, text: string) => page.getByRole('banner').getByText(text, { exact: true });
const endSlotButton = (page: Page, text: string) => page.getByRole('navigation').getByRole('button', { name: text, exact: true });
const notExportedChip = (page: Page) => page.getByRole('button', { name: /^Not exported/ });

/** Checks a quarter against a book that also reads 0, from wherever its Check button is. */
async function checkZero(page: Page, check: Locator, label: string) {
  await check.click();
  await page.getByLabel(new RegExp(`Our game score after ${label}`)).fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

test('ended game: Final, reload, Reopen game', async ({ page }) => {
  await onePlayerGame(page);
  // Every quarter checked, so the only prompt left for an ended game is the not-exported one.
  for (const q of ['Q1', 'Q2', 'Q3']) {
    await page.getByRole('button', { name: `End ${q}`, exact: true }).click();
    await checkZero(page, page.getByRole('button', { name: `Check ${q} — not checked against the book` }), q);
  }
  await endSlotButton(page, 'End Q4').click();
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
  await expect(endSlotButton(page, 'End Q4')).toBeVisible();
  await expect(endSlotButton(page, 'Final')).toHaveCount(0);
  await expect(notExportedChip(page)).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Reopened game');
});

test('a live game: Final / export, then End game early with a confirm', async ({ page }) => {
  await onePlayerGame(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
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

  await page.getByRole('button', { name: 'More', exact: true }).click();
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
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Final / export' }).click();
  await downloadCsv(page, page.getByRole('button', { name: 'Book CSV' }));
  await downloadCsv(page, page.getByRole('button', { name: 'Plays CSV' }));
  await page.getByRole('button', { name: 'New game' }).click();

  // No opponent was typed, so the game is named for its date (MM-DD).
  await expect(page.getByText(/A game is in progress \(vs \d{2}-\d{2}\)\.$/)).toBeVisible();
  await expect(page.getByText('Exported ✓', { exact: true })).toBeVisible();
  const buttons = page.getByRole('main').getByRole('button');
  await expect(buttons.first()).toHaveText('Discard and start new');
  await expect(buttons.first()).toHaveClass(/bg-white/);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).not.toHaveClass(/bg-white/);
});

test('a play added after both exports marks both files not saved again', async ({ page }) => {
  await onePlayerGame(page);
  const exportState = (kind: 'book' | 'plays') => page.getByTestId(`export-state-${kind}`);
  const openFinal = async () => {
    await page.getByRole('button', { name: 'More', exact: true }).click();
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
  await page.getByLabel(/Our game score after Q1/).fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(exportState('plays')).toHaveText(/not saved/);
  await page.getByRole('button', { name: 'Back to game' }).click();
  await expect(notExportedChip(page)).toHaveText('Not exported');

  // And New game asks to export first.
  await page.getByRole('button', { name: 'More', exact: true }).click();
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
  await page.getByLabel(/Our game score after Q1/).fill('7'); // a mismatch, so the plays list shows too
  // The End Q1 notice stays behind on Live: it would cover the plays to fix.
  await expect(page.getByTestId('feedback-text')).toHaveCount(0);
  // A play added from the check does show its notice, and the list scrolls clear of it.
  await page.getByRole('region', { name: 'Plays to fix', exact: true }).getByRole('button', { name: 'Add play to Q1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '#4 Player One', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByTestId('feedback-text')).toHaveText(/^Added #4 \(Home\) \+2 to Q1/);

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
  await page.getByRole('navigation').getByRole('button', { name: 'Book', exact: true }).click();
  await page.getByRole('tab', { name: 'Plays', exact: true }).click();

  const q1 = page.getByRole('region', { name: 'Q1', exact: true });
  const rows = q1.getByRole('button');
  await expect(rows).toHaveCount(2);
  // The chevron is decoration: the name is the row text alone.
  await expect(rows.first()).toHaveAccessibleName('#4 Player One (Home) · Foul');
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One (Home) · +2');

  await rows.nth(1).click();
  const fix = page.getByRole('dialog');
  await expect(fix).toHaveAccessibleName('Fix: #4 (Home) +2 · Q1');
  await expect(fix.getByRole('group', { name: 'Play', exact: true })).toBeVisible();
  await expect(fix.getByRole('group', { name: 'Player', exact: true })).toBeVisible();
  await fix.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(fix).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Deleted #4 (Home) +2');
  await expect(rows).toHaveCount(1);

  await page.getByRole('status').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One (Home) · +2');
});

test("the check's Add-play sheet shows only what was added while it is open, and its list is oldest first", async ({ page }) => {
  await onePlayerGame(page);
  await tap(page, card(page, '4', 'Player One'), '+2');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('button', { name: 'Check Q1 — not checked against the book' }).click();
  await page.getByLabel(/Our game score after Q1/).fill('9');
  // An entry from before the sheet opens is on the check's own line (End Q1's stays on Live, so add one here)...
  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByTestId('feedback-text')).toHaveText(/^Added #4 \(Home\) \+2 to Q1/);

  await page.getByRole('button', { name: 'Add play to Q1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /#4 Player One/ }).click();
  // ...but not inside the sheet.
  const status = page.getByRole('dialog').getByTestId('sheet-status');
  await expect(status).toHaveText('');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  // An FT keeps the sheet open, and what it added does show.
  await page.getByRole('dialog').getByRole('button', { name: 'FT made', exact: true }).click();
  await expect(status).toHaveText('Added #4 (Home) FT made to Q1');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  // The check's list stays oldest first, to walk beside the book.
  const rows = page.getByRole('region', { name: 'Plays to fix' }).getByRole('region', { name: 'Q1' }).getByRole('button');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toHaveAccessibleName('#4 Player One (Home) · +2');
  await expect(rows.nth(1)).toHaveAccessibleName('#4 Player One (Home) · +2');
  await expect(rows.nth(2)).toHaveAccessibleName('#4 Player One (Home) · FT made');
});

test('Log: a fix that changes the player and the quarter, with the plays after it, is one Undo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player One');
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByLabel('Player 2 number', { exact: true }).fill('00');
  await page.getByLabel('Player 2 name', { exact: true }).fill('Player Two');
  await page.getByRole('button', { name: 'Start game' }).click();
  const one = card(page, '4', 'Player One');
  await tap(page, one, '+2');
  await tap(page, one, 'Foul');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Book', exact: true }).click();
  await page.getByRole('tab', { name: 'Plays', exact: true }).click();

  const q1 = page.getByRole('region', { name: 'Q1', exact: true });
  const q2 = page.getByRole('region', { name: 'Q2', exact: true });
  await q1.getByRole('button', { name: /^#4 Player One \(Home\) · \+2/ }).click();
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

  await expect(page.getByTestId('feedback-text')).toHaveText('Edited #4 (Home) +2 → #00 (Home) +2; moved 2 plays to Q2');
  await expect(q1).toHaveCount(0);
  await expect(q2.getByRole('listitem')).toHaveCount(2);
  await expect(q2.getByRole('button', { name: /^#00 Player Two \(Home\) · \+2/ })).toBeVisible();

  // One Undo restores both the player and the quarter.
  await page.getByRole('status').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(q2).toHaveCount(0);
  await expect(q1.getByRole('listitem')).toHaveCount(2);
  await expect(q1.getByRole('button', { name: '#4 Player One (Home) · +2', exact: true })).toBeVisible();
  await expect(q1.getByRole('button', { name: '#4 Player One (Home) · Foul', exact: true })).toBeVisible();
});

test('Redo: five Undos where four were meant, then Redo puts the last one back; a new play ends Redo', async ({ page }) => {
  await onePlayerGame(page);
  const card = page.getByRole('button', { name: /^#4,/ });
  for (let i = 0; i < 5; i++) {
    await card.click();
    await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  }
  await expect(page.getByLabel('Score Home 10, Away 0')).toBeVisible();
  const undo = page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true });
  for (let i = 0; i < 5; i++) await undo.click();
  await expect(page.getByLabel('Score Home 0, Away 0')).toBeVisible();
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await expect(page.getByTestId('feedback-text')).toHaveText('Undid #4 (Home) +2');
  await redo.click();
  await expect(page.getByLabel('Score Home 2, Away 0')).toBeVisible();
  await expect(page.getByTestId('feedback-text')).toHaveText('Redid #4 (Home) +2');
  // More is left to redo, so Redo stays; a new play forks the history and Redo goes.
  await expect(redo).toBeVisible();
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: '+3', exact: true }).click();
  await expect(page.getByLabel('Score Home 5, Away 0')).toBeVisible();
  await expect(redo).toHaveCount(0);
});

test('the End button is blue for a quarter, red once it can end the game, plain at Final', async ({ page }) => {
  await onePlayerGame(page);
  const tone = (name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });
  await expect(tone('End Q1')).toHaveAttribute('data-tone', 'quarter');
  await expect(tone('End Q1')).toHaveCSS('border-color', 'oklch(0.746 0.16 232.661)'); // sky-400
  for (const q of ['Q1', 'Q2', 'Q3']) await tone(`End ${q}`).click();
  await expect(tone('End Q4')).toHaveAttribute('data-tone', 'game');
  await expect(tone('End Q4')).toHaveCSS('border-color', 'oklch(0.637 0.237 25.331)'); // red-500
  await tone('End Q4').click();
  await page.getByRole('dialog').getByRole('button', { name: /^End game/ }).click();
  await page.getByRole('button', { name: 'Back to game', exact: true }).click();
  await expect(tone('Final')).toHaveAttribute('data-tone', 'final');
});

/** Two real taps at the same spot `gapMs` apart, without waiting for the button under them (a double-tap). */
async function doubleTap(page: Page, target: Locator, gapMs = 150) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(gapMs);
  await page.mouse.click(x, y);
}

test('a double-tap on End Q1 ends only Q1; a second End after a second still works', async ({ page }) => {
  await onePlayerGame(page);
  await doubleTap(page, endSlotButton(page, 'End Q1'));
  await expect(stripPeriod(page, 'Q2')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(stripPeriod(page, 'Q2')).toBeVisible();
  await expect(stripPeriod(page, 'Q3')).toHaveCount(0);
  // Past the guard, End works again.
  await page.waitForTimeout(1100);
  await page.mouse.click(...(await center(endSlotButton(page, 'End Q2'))));
  await expect(stripPeriod(page, 'Q3')).toBeVisible();
  // Undo still undoes an End.
  await page.waitForTimeout(1100);
  await page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(stripPeriod(page, 'Q2')).toBeVisible();
});

test('a double-tap on End Q4 opens its sheet and chooses nothing: the game is not ended', async ({ page }) => {
  await onePlayerGame(page);
  for (const q of ['Q1', 'Q2', 'Q3']) await endSlotButton(page, `End ${q}`).click();
  // End Q3 starts the guard too: tap End Q4 only once it takes taps.
  await expect(endSlotButton(page, 'End Q4')).toBeEnabled();
  await doubleTap(page, endSlotButton(page, 'End Q4'));
  const sheet = page.getByRole('dialog', { name: 'End Q4' });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  await expect(sheet).toBeVisible();
  await expect(stripPeriod(page, 'Q4')).toBeVisible();
  // Past the guard, the sheet's choices work.
  await sheet.getByRole('button', { name: 'Start overtime', exact: true }).click();
  await expect(stripPeriod(page, 'OT1')).toBeVisible();
});

const center = async (l: Locator): Promise<[number, number]> => {
  const b = (await l.boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2];
};

test('the page has a favicon that loads', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await request.get(href!)).status()).toBe(200);
});

test("the check's player fouls are labeled as whole-game totals, apart from the quarter's team fouls", async ({ page }) => {
  await onePlayerGame(page);
  await tap(page, card(page, '4', 'Player One'), 'Foul');
  await page.getByRole('button', { name: 'End Q1', exact: true }).click();
  await tap(page, card(page, '4', 'Player One'), 'Foul');
  await page.getByRole('navigation').getByRole('button', { name: 'Book', exact: true }).click();
  await page.getByRole('tab', { name: 'Plays', exact: true }).click();
  await page.getByRole('region', { name: 'Q1', exact: true }).getByRole('button', { name: 'Not checked', exact: true }).click();
  // Q1 had one of their two fouls: the quarter's count and their game total sit under separate labels.
  await expect(page.getByText(/^Team fouls in Q1:/)).toHaveText('Team fouls in Q1: 1');
  await expect(page.getByRole('list', { name: 'Player fouls, whole game' }).getByRole('listitem')).toHaveText(['#4 Player One2']);
});

test("setup: the other team's roster is optional, numbered, and starts the game with it", async ({ page }) => {
  const score = (us: number, opp: number) => page.getByLabel(`Score Home ${us}, Away ${opp}`);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Their roster \(optional\)/ })).toBeVisible();
  // No players at all, theirs or ours: Start succeeds.
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(score(0, 0)).toBeVisible();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await page.getByLabel('Their player 1 name', { exact: true }).fill('Visitor One');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('alert')).toContainText('Every player needs a jersey number.');

  await page.getByLabel('Their player 1 number', { exact: true }).fill('14');
  await page.getByRole('button', { name: 'Add their player' }).click();
  await page.getByLabel('Their player 2 number', { exact: true }).fill('24');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(score(0, 0)).toBeVisible();

  // Theirs is not saved: a new game starts with it empty.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.getByLabel('Their player 1 number', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Their player 2 number', { exact: true })).toHaveCount(0);
});

// ---- Both teams on the live screen: Home vs Away halves ----------------------------------------

/** A game with `ours` players (#10 up) and `theirs` (#50 up), at home unless `away`. */
async function twoTeamGame(page: Page, { ours = 2, theirs = 2, away = false, team = '', opponent = '' } = {}) {
  await page.goto('/');
  if (team || opponent) {
    await page.getByText('Game details', { exact: true }).click();
    await page.getByLabel('Opponent (optional)').fill(opponent);
    await page.getByLabel('Our team (optional)').fill(team);
  }
  if (away) await page.getByRole('group', { name: 'Home or away' }).getByRole('button', { name: 'Away', exact: true }).click();
  for (let i = 0; i < ours; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player', exact: true }).click();
    await page.getByLabel(`Player ${i + 1} number`, { exact: true }).fill(String(10 + i));
    await page.getByLabel(`Player ${i + 1} name`, { exact: true }).fill(`Player ${i + 1}`);
  }
  await ui(page).fillOppRoster(Array.from({ length: theirs }, (_, i) => ({ number: String(50 + i) })));
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
}

/** HSL lightness (0–1) of an element's background, whatever color syntax the browser reports. */
const bgLightness = (l: Locator) =>
  l.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  });

const scrolls = (l: Locator) => l.evaluate((el) => el.scrollHeight > el.clientHeight);

test('both halves: Home left and light, Away right and dark, US tag on our side', async ({ page }) => {
  for (const away of [false, true]) {
    await twoTeamGame(page, { away });
    const app = ui(page);
    const home = app.half('Home');
    const visitors = app.half('Away');
    expect((await home.boundingBox())!.x).toBeLessThan((await visitors.boundingBox())!.x);
    // The row carries the fill (1.1): the number area inside it is transparent.
    const [homeNo, awayNo] = away ? ['50', '10'] : ['10', '50'];
    expect(await bgLightness(app.row('Home', homeNo))).toBeGreaterThan(0.8);
    expect(await bgLightness(app.row('Away', awayNo))).toBeLessThan(0.3);
    const [ours, theirs]: Side[] = away ? ['Away', 'Home'] : ['Home', 'Away'];
    await expect(app.half(ours).getByText('US', { exact: true })).toBeVisible();
    await expect(app.half(theirs).getByText('US', { exact: true })).toHaveCount(0);
    // Both halves end with + Play, Bench and the timeout buttons.
    for (const side of ['Home', 'Away'] as const) {
      await expect(app.half(side).getByRole('button', { name: '+ Play', exact: true })).toBeVisible();
      await expect(app.half(side).getByRole('button', { name: 'Bench / coach tech', exact: true })).toBeVisible();
      await expect(app.half(side).getByRole('button', { name: 'Full: 3', exact: true })).toBeVisible();
      await expect(app.half(side).getByRole('button', { name: '30s: 2', exact: true })).toBeVisible();
    }
    await page.evaluate(() => localStorage.clear());
  }
});

test('Our team on the left (Experiments): an away game puts ours left, colors stay with Home/Away, the strip follows', async ({ page }) => {
  // Owner request 2026-11-23: Home/Away stays left/right by default; the switch puts our team on the left.
  await twoTeamGame(page, { away: true });
  const app = ui(page);
  const x = async (side: Side) => (await app.half(side).boundingBox())!.x;
  expect(await x('Home')).toBeLessThan(await x('Away')); // default: Home left, even on an away night
  await app.half('Away').getByRole('button', { name: /^#10,/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Score Home 0, Away 2')).toHaveText('0–2');

  await page.getByRole('navigation').getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Experiments', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Our team on the left', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  expect(await x('Away')).toBeLessThan(await x('Home')); // ours (Away) now left
  await expect(page.getByLabel('Score Away 2, Home 0')).toHaveText('2–0');
  expect(await bgLightness(app.row('Away', '10'))).toBeLessThan(0.3); // Away stays dark
  expect(await bgLightness(app.row('Home', '50'))).toBeGreaterThan(0.8); // Home stays light

  // The Book's team toggle follows: ours first.
  await page.getByRole('navigation').getByRole('button', { name: 'Book', exact: true }).click();
  const teams = page.getByRole('group', { name: 'Team' }).getByRole('button');
  await expect(teams.first()).toHaveText(/Away/);
  await page.evaluate(() => localStorage.clear());
});

test('activity swap: a bench scorer trades rows with the longest-idle top player, only after a pause in tapping', async ({ page }) => {
  // Owner, 2026-11-23: sort by activity, moving rows only after the scorer stops tapping (SETTLE_MS: 2 s from 1.1, spec decision 4).
  await page.clock.install({ time: new Date('2026-11-23T18:00:00') });
  await twoTeamGame(page, { ours: 7, theirs: 2 });
  const before = ['10', '11', '12', '13', '14', '15', '16'];
  expect(await cardOrder(page, 'Home')).toEqual(before);
  await tap(page, ui(page).half('Home').getByRole('button', { name: /^#10,/ }), '+2');
  await tap(page, ui(page).half('Home').getByRole('button', { name: /^#16,/ }), 'FT made', 'FT made');
  // Still tapping: nothing moves, and a touch 1.5 s in restarts the wait.
  await page.clock.fastForward(1500);
  expect(await cardOrder(page, 'Home')).toEqual(before);
  await page.mouse.click(195, 12); // the score in the strip: a touch, not a button
  await page.clock.fastForward(1500);
  expect(await cardOrder(page, 'Home')).toEqual(before);
  // The pause: #16 takes #11's slot (#10 played, so #11 is the earliest never-played top row).
  await page.clock.fastForward(1000);
  await expect.poll(() => cardOrder(page, 'Home')).toEqual(['10', '16', '12', '13', '14', '15', '11']);
  await page.evaluate(() => localStorage.clear());
});

/** A half's header: its title (name and tags) and its Team fouls count. */
const header = (app: ReturnType<typeof ui>, side: Side) => ({
  title: app.half(side).getByTestId('half-title'),
  fouls: app.half(side).getByText(/^Team fouls \d+$/),
});

test('half headers name the teams when given (audit 0.11.0 F3); a default opponent shows just the side', async ({ page }) => {
  // Owner ruling 2026-11-23 on F3: the typed name shows, Home/Away stays as a small tag above it, US stays on ours.
  await twoTeamGame(page, { team: 'Maple Hill', opponent: 'Cedar Run' });
  let app = ui(page);
  await expect(header(app, 'Home').title).toHaveText('HomeMaple HillUS');
  await expect(header(app, 'Away').title).toHaveText('AwayCedar Run');
  await page.evaluate(() => localStorage.clear());

  // No opponent typed: the game is named MM-DD, which is not a team name, so the half reads plain "Away".
  // An away game with our name typed: the name sits on the right half, tagged Away.
  await twoTeamGame(page, { team: 'Maple Hill', away: true });
  app = ui(page);
  await expect(header(app, 'Home').title).toHaveText('Home');
  await expect(header(app, 'Away').title).toHaveText('AwayMaple HillUS');
});

test('a long team name truncates: Team fouls and the tags stay whole, the header keeps its height, 10 a side still fit', async ({ page }) => {
  const long = 'Slumberland Consolidated Junior High Somnambulists'; // invented: Little Nemo in Slumberland (Winsor McCay, 1905)
  await twoTeamGame(page, { ours: 10, theirs: 10, team: long, opponent: `${long} Two` });
  const app = ui(page);
  for (const side of ['Home', 'Away'] as const) {
    const { title, fouls } = header(app, side);
    const name = title.getByText(side === 'Home' ? long : `${long} Two`, { exact: true });
    // The name is cut with an ellipsis, not wrapped: one line, wider content than its box, and clipped
    // there, so it cannot paint over Team fouls (a nowrap name without overflow:hidden would).
    expect(await name.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    expect(await name.evaluate((e) => [getComputedStyle(e).overflow, getComputedStyle(e).textOverflow])).toEqual(['hidden', 'ellipsis']);
    const half = (await app.half(side).boundingBox())!;
    const f = (await fouls.boundingBox())!;
    const t = (await title.boundingBox())!;
    // Team fouls fully inside the half, to the right of the title, never overlapping it.
    expect(f.x + f.width).toBeLessThanOrEqual(half.x + half.width);
    expect(t.x + t.width).toBeLessThanOrEqual(f.x);
    expect(await fouls.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    // The side tag (and US on ours) are still there, whole.
    const tag = title.getByText(side, { exact: true });
    expect(await tag.evaluate((e) => e.scrollWidth <= e.clientWidth && e.getBoundingClientRect().width > 0)).toBe(true);
    // The header row is the same 28 px (h-7) it is with no name, so no card moves down.
    const row = (await title.locator('..').boundingBox())!;
    expect(row.height).toBe(28);
    // The tag and name lines sit inside the row with at least 1 px to spare top and bottom, so the text
    // neither spills into the strip or onto the cards nor sits flush against them.
    for (const box of [t, (await name.boundingBox())!, (await tag.boundingBox())!]) {
      expect(box.y).toBeGreaterThanOrEqual(row.y + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(row.y + row.height - 1);
    }
  }
  await expect(header(app, 'Home').title.getByText('US', { exact: true })).toBeVisible();
  await app.expectControlsInView();
  expect(await noOverflow(page)).toBe(true);
});

/**
 * Writes subs into the saved game and reloads (Task 5 records them from the sheet). Each takes roster
 * indexes in and out, for our team (`us`) or theirs (`them`), after every play so far.
 */
async function seedSubs(page: Page, subs: { side: 'us' | 'them'; ins: number[]; outs: number[] }[]) {
  await page.evaluate((list) => {
    const g = JSON.parse(localStorage.getItem('benchbook:game')!);
    const order = Math.max(-1, ...g.events.map((e: { order: number }) => e.order)) + 1;
    g.subs = list.map((s, k) => {
      const roster: { id: string }[] = s.side === 'us' ? g.roster : g.oppRoster;
      return { id: `s${k}`, side: s.side, ins: s.ins.map((i) => roster[i].id), outs: s.outs.map((i) => roster[i].id), order: order + k, period: 1, enteredAt: new Date().toISOString() };
    });
    localStorage.setItem('benchbook:game', JSON.stringify(g));
  }, subs);
  await page.reload();
}

/** The alpha (0-255) of an element's own background fill. */
const fillAlpha = (l: Locator) =>
  l.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  });

/** Every row's number in a half, in display order (1.1: rows are groups labeled `Home #23, on floor`). */
const cardOrder = (page: Page, side: Side) =>
  ui(page).half(side).getByRole('group').evaluateAll((els) => els.map((el) => /^(?:Home|Away) #(\S+),/.exec(el.getAttribute('aria-label')!)![1]));
const nums = (from: number, n: number) => Array.from({ length: n }, (_, i) => String(from + i));

test('the floor: rows are one style, the top five lead, the rest take a fill step (D1, D2)', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  for (const [side, first] of [['Home', 10], ['Away', 50]] as const) {
    expect(await app.floorOf(side)).toEqual(nums(first, 5));
    // D1: no "bench" tag on the screen; screen readers still hear ", bench" (spec Accessibility: the row group's label).
    await expect(app.half(side).getByText('bench', { exact: true })).toHaveCount(0);
    const benchRow = app.row(side, String(first + 5));
    await expect(benchRow).toHaveAccessibleName(`${side} #${first + 5}, bench`);
    await expect(app.half(side).getByRole('button', { name: new RegExp(`^#${first + 5},`) })).toHaveAccessibleName(`#${first + 5}, 0 points, 0 fouls, more plays`);
    // D1: every row is solid and the same 56 px tall (spec decision 3).
    const top = app.row(side, String(first));
    expect(await fillAlpha(benchRow)).toBe(255);
    expect(await fillAlpha(top)).toBe(255);
    expect((await benchRow.boundingBox())!.height).toBe(56);
    expect((await top.boundingBox())!.height).toBe(56);
    // D2: the row after the top five has a different fill; the top five share one.
    const fill = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fill(benchRow)).not.toBe(await fill(top));
    expect(await fill(app.row(side, String(first + 4)))).toBe(await fill(top));
    // Before the team's first play its Sub button reads Starters, in gray.
    await expect(app.subButton(side)).toHaveText('Starters');
    await expect(app.subButton(side)).not.toHaveClass(/amber/);
  }
  // A starter's play: the label becomes Sub, for that team only.
  await tap(page, app.half('Home').getByRole('button', { name: /^#10,/ }), '+2');
  await expect(app.subButton('Home')).toHaveText('Sub');
  await expect(app.subButton('Away')).toHaveText('Starters');
  expect(await app.floorOf('Home')).toEqual(nums(10, 5));
  await page.evaluate(() => localStorage.clear());
  // Five players or fewer: all on the floor and no Sub button.
  await twoTeamGame(page, { ours: 5, theirs: 2 });
  expect(await app.floorOf('Home')).toEqual(nums(10, 5));
  for (const side of ['Home', 'Away'] as const) {
    await expect(app.half(side).getByText('bench', { exact: true })).toHaveCount(0);
    await expect(app.subButton(side)).toHaveCount(0);
  }
});

test('a bench player\'s +2 puts them on the floor in place, and the Sub button stays a gray "Sub" (D3)', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  for (const [side, first] of [['Home', 10], ['Away', 50]] as const) {
    const order = await cardOrder(page, side);
    const n = String(first + 5);
    const sixth = app.half(side).getByRole('button', { name: new RegExp(`^#${n},`) });
    // The tap scrolls the row fully into view first (the list scrolls, 1.1), so measure it there.
    await sixth.scrollIntoViewIfNeeded();
    const box = (await sixth.boundingBox())!;
    await tap(page, sixth, '+2');
    expect(await app.floorOf(side)).toEqual(nums(first, 6));
    await expect(app.row(side, n)).toHaveAccessibleName(`${side} #${n}, on floor`);
    // In place: same order, same box (the activity swap waits for a pause, SETTLE_MS).
    expect(await cardOrder(page, side)).toEqual(order);
    expect(await sixth.boundingBox()).toEqual(box);
    await expect(app.subButton(side)).toHaveText('Sub');
    await expect(app.subButton(side)).not.toHaveClass(/amber/);
  }
  // Other plays change nothing about the label or its color.
  await tap(page, app.half('Away').getByRole('button', { name: /^#50,/ }), '+2');
  await expect(app.subButton('Home')).not.toHaveClass(/amber/);
  await expect(app.subButton('Away')).toHaveText('Sub');
});

test('10 + 10: controls in view, no sideways scroll', async ({ page }) => {
  await twoTeamGame(page, { ours: 10, theirs: 10 });
  const app = ui(page);
  await app.expectControlsInView();
  for (const side of ['Home', 'Away'] as const) {
    const h = app.half(side);
    // + Play, Sub and Tech share one row, each at least 44 px; the timeouts are 44 px (spec "The list and the swap").
    const row = await Promise.all([
      h.getByRole('button', { name: '+ Play', exact: true }),
      app.subButton(side),
      h.getByRole('button', { name: 'Bench / coach tech', exact: true }),
    ].map(async (b) => (await b.boundingBox())!));
    for (const b of row) expect(b.height).toBeGreaterThanOrEqual(44);
    expect(new Set(row.map((b) => b.y)).size).toBe(1);
    await expect(h.getByRole('button', { name: 'Bench / coach tech', exact: true })).toHaveText('Tech');
    for (const t of ['Full: 3', '30s: 2']) expect((await h.getByRole('button', { name: t, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  // Still so once bench players have played.
  await tap(page, app.half('Home').getByRole('button', { name: /^#19,/ }), '+2');
  await tap(page, app.half('Away').getByRole('button', { name: /^#59,/ }), 'Foul');
  await app.expectControlsInView();
  expect(await noOverflow(page)).toBe(true);
});

test('12 players: one list scrolls, controls stay put', async ({ page }) => {
  await twoTeamGame(page, { ours: 12, theirs: 3 });
  const app = ui(page);
  const home = app.half('Home');
  const list = home.getByTestId('row-list');
  // The half itself does not scroll, nor the page: only the row list does.
  expect(await scrolls(home)).toBe(false);
  expect(await scrolls(list)).toBe(true);
  expect(await scrolls(app.half('Away'))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  expect(await cardOrder(page, 'Home')).toEqual(nums(10, 12));
  const fixed = ['+ Play', 'Starters', 'Bench / coach tech', 'Full: 3', '30s: 2'];
  const boxes = async () => Promise.all(fixed.map(async (n) => (await home.getByRole('button', { name: n, exact: true }).boundingBox())!));
  const before = await boxes();
  // Scrolled to the bottom: every control is where it was, and the last row is reachable above them.
  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await boxes()).toEqual(before);
  const last = (await app.row('Home', '21').boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(before[0].y);
  await app.expectControlsInView();

  // The top block is the floor as the last sub left it, 6 on or 4 on, then an extra 8 px gap (spec "The row": 8 px apart, 16 px after the top block).
  for (const [ins, outs, floor] of [[[5], [], nums(10, 6)], [[], [0], nums(11, 4)]] as const) {
    await page.evaluate(() => localStorage.clear());
    await twoTeamGame(page, { ours: 12, theirs: 3 });
    await seedSubs(page, [{ side: 'us', ins: [...ins], outs: [...outs] }]);
    const all = await cardOrder(page, 'Home');
    expect(all.slice(0, floor.length), `${floor.length} on`).toEqual([...floor]);
    expect(await app.floorOf('Home')).toEqual([...floor]);
    const gap = async (k: number) => {
      const a = (await app.row('Home', all[k - 1]).boundingBox())!;
      const b = (await app.row('Home', all[k]).boundingBox())!;
      return Math.round(b.y - (a.y + a.height));
    };
    expect(await gap(1)).toBe(8);
    expect(await gap(floor.length)).toBe(16);
    expect(await gap(floor.length + 1)).toBe(8);
  }
});

const homeCard = (page: Page, n: string | number) => ui(page).half('Home').getByRole('button', { name: new RegExp(`^#${n}(,| )`) });
const awayCard = (page: Page, n: string | number) => ui(page).half('Away').getByRole('button', { name: new RegExp(`^#${n}(,| )`) });
/** A row in the sub sheet, by number. */
const subRow = (page: Page, n: string | number) => page.getByRole('dialog').getByRole('button', { name: new RegExp(`^#${n}(,| |$)`) });

test('deliberate sub: #15 checks in for #10 in 3 taps; the toast names both and the half regroups', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  await tap(page, homeCard(page, 11), '+2');
  // A floor player's sheet offers "comes out"; a bench player's "checks in". The plays sit in the same place on both.
  await homeCard(page, 11).click();
  await expect(sheet.getByRole('button', { name: '#11 comes out', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /checks in$/ })).toHaveCount(0);
  const floorPlus2 = (await sheet.getByRole('button', { name: '+2', exact: true }).boundingBox())!;
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  // Tap 1: the bench player's card.
  await homeCard(page, 15).click();
  const row = sheet.getByRole('button', { name: '#15 checks in', exact: true });
  await expect(sheet.getByRole('button', { name: /comes out$/ })).toHaveCount(0);
  expect(await sheet.getByRole('button', { name: '+2', exact: true }).boundingBox()).toEqual(floorPlus2);
  // At the foot, below the plays and the Done row with at least 8px between, a 44px gray outline.
  const done = (await sheet.getByRole('button', { name: 'Done', exact: true }).boundingBox())!;
  const r = (await row.boundingBox())!;
  expect(r.y).toBeGreaterThanOrEqual(done.y + done.height + 8);
  expect(r.height).toBeGreaterThanOrEqual(44);
  await expect(row).toHaveClass(/border-slate-/);
  await expect(row).not.toHaveClass(/bg-white|sky|amber|green/);
  // Tap 2: the sub row. #15 is already on, so the floor is 6.
  await row.click();
  await expect(sheet).toHaveAccessibleName('Who went out?');
  await expect(subRow(page, 15)).toHaveAccessibleName('#15 Player 6, just in');
  // Tap 3: the partner. Five on, so it closes and records.
  await subRow(page, 10).click();
  await expect(sheet).toHaveCount(0);
  await app.expectToastUndo('#15 (Home) in for #10');
  // D5: #15 takes #10's slot and #10 takes #15's old one; nothing else moves.
  expect(await app.floorOf('Home')).toEqual(['15', '11', '12', '13', '14']);
  expect(await cardOrder(page, 'Home')).toEqual(['15', '11', '12', '13', '14', '10', '16']);
  await expect(app.subButton('Home')).toHaveText('Sub');
});

test('forgotten sub: #15 scores from the bench, Sub, "Who went out?" with #15 "just in" and a quiet "longest without a play" hint; one tap on that player closes it at 5', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  await tap(page, homeCard(page, 10), '+2');
  await tap(page, homeCard(page, 15), '+2');
  await expect(app.subButton('Home')).toHaveText('Sub');
  await app.subButton('Home').click();
  await expect(sheet).toHaveAccessibleName('Who went out?');
  // The floor, all six, and nobody from the bench.
  expect(await sheet.getByRole('button', { name: /^#/ }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual([
    '#10 Player 1', '#11 Player 2, longest without a play', '#12 Player 3', '#13 Player 4', '#14 Player 5', '#15 Player 6, just in',
  ]);
  await expect(sheet.getByText('likely')).toHaveCount(0);
  // Both are information: gray. "just in" is a fact, a boxed tag; the suggestion is only a hint, plain
  // lighter text with no box, still readable (4.5:1) on the pressed row.
  const justIn = sheet.getByText('just in', { exact: true });
  const hint = sheet.getByText('longest without a play', { exact: true });
  for (const tag of [justIn, hint]) {
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveClass(/text-slate-/);
  }
  await expect(justIn).toHaveClass(/border/);
  await expect(justIn).toHaveClass(/font-semibold/);
  await expect(hint).not.toHaveClass(/border/);
  await expect(hint).not.toHaveClass(/font-semibold/);
  expect(await contrast(hint)).toBeGreaterThanOrEqual(4.5);
  await expect(sheet).not.toContainText('Done');
  await subRow(page, 11).click();
  await expect(sheet).toHaveCount(0);
  // D5 (final review I-3): #15 came in by playing, so they take #11's card slot.
  expect(await app.floorOf('Home')).toEqual(['10', '15', '12', '13', '14']);
  // The toast names the swap: #15 came in by playing, #11 is who they replaced. The stored sub is only #11 out.
  await app.expectToastUndo('#15 (Home) in for #11');
  await expect(app.subButton('Home')).toHaveText('Sub');
});

test('"Who went out?" says how many are on and how many to pick, and updates with each tap', async ({ page }) => {
  await twoTeamGame(page, { ours: 9, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  // Three bench players score: eight on.
  for (const n of [10, 15, 16, 17]) await tap(page, homeCard(page, n), '+2');
  await app.subButton('Home').click();
  await expect(sheet).toHaveAccessibleName('Who went out?');
  const pick = sheet.getByTestId('sub-pick');
  await expect(pick).toHaveText('8 on · pick 3');
  await subRow(page, 11).click();
  await expect(pick).toHaveText('7 on · pick 2');
  // A tap taken back counts back up.
  await subRow(page, 11).click();
  await expect(pick).toHaveText('8 on · pick 3');
  await subRow(page, 11).click();
  await subRow(page, 12).click();
  await expect(pick).toHaveText('6 on · pick 1');
  await subRow(page, 13).click();
  await expect(sheet).toHaveCount(0);
  // Changed 2026-11-23 (activity swap): #15, #16 and #17 had already taken #11, #12 and #13's top slots,
  // so the three outs, already below, leave every card where it was. The floor is the same five.
  expect(await app.floorOf('Home')).toEqual(['10', '15', '16', '17', '14']);
});

test('line change at a quarter break: "Who\'s on the floor?", 4 toggles each way, Done; toast "Home floor updated"', async ({ page }) => {
  await twoTeamGame(page, { ours: 9, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  await tap(page, homeCard(page, 10), '+2');
  await page.getByRole('navigation').getByRole('button', { name: 'End Q1', exact: true }).click();
  await expect(app.subButton('Home')).toHaveText('Sub');
  await app.subButton('Home').click();
  await expect(sheet).toHaveAccessibleName("Who's on the floor?");
  // Its own count and Done stand in for a pick line.
  await expect(sheet.getByTestId('sub-pick')).toHaveCount(0);
  const group = (name: string) => sheet.getByRole('group', { name, exact: true }).getByRole('button', { name: /^#/ });
  await expect(group('On the floor')).toHaveCount(5);
  await expect(group('On the bench')).toHaveCount(4);
  const count = sheet.getByTestId('sub-count');
  await expect(count).toHaveText('5 on the floor');
  await expect(count).toHaveClass(/text-green-/);
  for (const n of [10, 11, 12, 13]) {
    await expect(subRow(page, n)).toHaveAttribute('aria-pressed', 'true');
    await subRow(page, n).click();
    await expect(subRow(page, n)).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(count).toHaveText('1 on the floor');
  await expect(count).not.toHaveClass(/green/);
  for (const n of [15, 16, 17]) await subRow(page, n).click();
  // Done never requires 5: at 4 the sheet is still open, waiting for Done.
  await expect(count).toHaveText('4 on the floor');
  await subRow(page, 18).click();
  await expect(count).toHaveText('5 on the floor');
  await expect(sheet).toHaveCount(1);
  await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toHaveClass(/bg-white/);
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await app.expectToastUndo('Home floor updated');
  // D5: ins and outs pair in order, so #15..#18 take the slots of #10..#13.
  expect(await app.floorOf('Home')).toEqual(['15', '16', '17', '18', '14']);
  expect(await cardOrder(page, 'Home')).toEqual(['15', '16', '17', '18', '14', '10', '11', '12', '13']);
});

test('foul-out: Sub → "Who came in?" → #15 closes it', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  for (let i = 0; i < 5; i++) await tap(page, homeCard(page, 10), 'Foul');
  await expect(app.subButton('Home')).toHaveText('Sub');
  await app.subButton('Home').click();
  await expect(sheet).toHaveAccessibleName('Who came in?');
  await expect(sheet.getByTestId('sub-pick')).toHaveText('4 on · pick 1');
  // The bench: the out player grayed with their reason, and not selectable.
  expect(await sheet.getByRole('button', { name: /^#/ }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual([
    '#10 Player 1, 5 fouls', '#15 Player 6', '#16 Player 7',
  ]);
  await expect(subRow(page, 10)).toBeDisabled();
  await expect(subRow(page, 10)).toHaveClass(/opacity-/);
  await subRow(page, 15).click();
  await expect(sheet).toHaveCount(0);
  expect(await app.floorOf('Home')).toEqual(['11', '12', '13', '14', '15']);
  await app.expectToastUndo('Home floor updated');
  await expect(app.subButton('Home')).toHaveText('Sub');
});

test('Starters: before the first play the button reads Starters; changing two starters and Done sets the floor; ignoring it keeps the first five', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  await expect(app.subButton('Home')).toHaveText('Starters');
  await app.setFloor('Home', ['12', '13', '14', '15', '16']);
  expect(await app.floorOf('Home')).toEqual(['15', '16', '12', '13', '14']); // D5: slots swap
  await app.expectToastUndo('Home floor updated');
  // The first play keeps that floor: the Starters sub sits before it.
  await tap(page, homeCard(page, 12), '+2');
  await expect(app.subButton('Home')).toHaveText('Sub');
  expect(await app.floorOf('Home')).toEqual(['15', '16', '12', '13', '14']);
  // Away ignores its Starters: the first five start, and a non-starter's play promotes them to a sixth.
  expect(await app.floorOf('Away')).toEqual(nums(50, 5));
  await tap(page, awayCard(page, 55), '+2');
  expect(await app.floorOf('Away')).toEqual(nums(50, 6));
  await expect(app.subButton('Away')).toHaveText('Sub');
});

test('"Who\'s on the floor?": Done with 4 on records the 4; Done with no change records nothing', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  // Unchanged Starters, then unchanged Sub: Done closes and nothing is recorded.
  await app.setFloor('Home', nums(10, 5));
  // Nothing recorded: the line still shows the first-use row tip (spec "First use and help"), no entry.
  await expect(page.getByTestId('feedback-text')).toHaveText('Tap a number for 3s, free throws and fixes.');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await tap(page, homeCard(page, 11), '+2');
  await app.setFloor('Home', nums(10, 5));
  await app.expectToastUndo('#11 (Home) +2');
  // Four on: Done takes it as it is.
  await app.subButton('Home').click();
  await subRow(page, 10).click();
  await expect(sheet.getByTestId('sub-count')).toHaveText('4 on the floor');
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(await app.floorOf('Home')).toEqual(nums(11, 4));
  await app.expectToastUndo('Home floor updated');
  await expect(app.subButton('Home')).toHaveText('Sub');
});

test('the sub row: only on a tracked team\'s player who is not out, and the plays sit at one height on every live play sheet; the check\'s Add play has no blank footer', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 3 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  const plus2 = async () => (await sheet.getByRole('button', { name: '+2', exact: true }).boundingBox())!;
  const subRows = sheet.getByRole('button', { name: /(checks in|comes out)$/ });
  const close = async () => {
    await sheet.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  };
  // A tracked team's player: the row is there.
  await homeCard(page, 10).click();
  await expect(subRows).toHaveCount(1);
  const at = await plus2();
  await close();
  // A team of five or fewer, and + Play: no row, and the plays where they were.
  await awayCard(page, 50).click();
  await expect(subRows).toHaveCount(0);
  expect(await plus2(), 'untracked player').toEqual(at);
  await close();
  await app.half('Home').getByRole('button', { name: '+ Play', exact: true }).click();
  await expect(subRows).toHaveCount(0);
  expect(await plus2(), '+ Play').toEqual(at);
  await close();
  // An out player: no row.
  for (let i = 0; i < 5; i++) await tap(page, homeCard(page, 10), 'Foul');
  await homeCard(page, 10).click();
  await expect(sheet.getByTestId('out-warning')).toBeVisible();
  await expect(subRows).toHaveCount(0);
  await close();
  // The space below Done: the live screen keeps the row's room (a 44px button and its rule), the check's Add play does not.
  const below = async () => {
    const d = (await sheet.boundingBox())!;
    const done = (await sheet.getByRole('button', { name: 'Done', exact: true }).boundingBox())!;
    return d.y + d.height - (done.y + done.height);
  };
  await homeCard(page, 11).click();
  expect(await below(), 'live sheet').toBeGreaterThan(60);
  await close();
  await page.getByRole('navigation').getByRole('button', { name: 'End Q1', exact: true }).click();
  await app.checkQuarter('Q1', 0, 0);
  await app.fixRegion().getByRole('button', { name: 'Add play to Q1', exact: true }).click();
  await sheet.getByRole('button', { name: /^#11( |$)/ }).click();
  await expect(sheet.getByRole('button', { name: '+2', exact: true })).toBeVisible();
  await expect(subRows).toHaveCount(0);
  // Only the sheet's own 24px padding: no blank footer.
  expect(await below(), "check's Add play").toBeLessThanOrEqual(25);
});

test('Undo after a sub restores the previous floor', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  await tap(page, homeCard(page, 11), '+2');
  await app.subIn('Home', '15', '10');
  expect(await app.floorOf('Home')).toEqual(['15', '11', '12', '13', '14']); // D5
  await app.undo();
  expect(await app.floorOf('Home')).toEqual(nums(10, 5));
  expect(await cardOrder(page, 'Home')).toEqual(nums(10, 7));
  // One step: the play before it is still there.
  await expect(homeCard(page, 11)).toHaveAccessibleName(/, 2 points,/);
});

test('Cancel records nothing', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  const sheet = page.getByRole('dialog');
  await tap(page, homeCard(page, 11), '+2');
  for (const close of ['cancel', 'backdrop'] as const) {
    await app.subButton('Home').click();
    await subRow(page, 10).click();
    await subRow(page, 15).click();
    if (close === 'cancel') await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    else await page.mouse.click(10, 10);
    await expect(sheet).toHaveCount(0);
    expect(await app.floorOf('Home'), close).toEqual(nums(10, 5));
    await app.expectToastUndo('#11 (Home) +2');
  }
  // From a play sheet's row too: the pre-moved player goes back.
  await homeCard(page, 15).click();
  await sheet.getByRole('button', { name: '#15 checks in', exact: true }).click();
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await app.floorOf('Home')).toEqual(nums(10, 5));
  await app.expectToastUndo('#11 (Home) +2');
});

test("the other team's sub works the same (Away)", async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  await tap(page, awayCard(page, 51), '+2');
  await app.subIn('Away', '55', '50');
  await app.expectToastUndo('#55 (Away) in for #50');
  expect(await app.floorOf('Away')).toEqual(['55', '51', '52', '53', '54']); // D5
  expect(await app.floorOf('Home')).toEqual(nums(10, 5));
  // Its foul-out asks "Who came in?" the same way.
  for (let i = 0; i < 5; i++) await tap(page, awayCard(page, 51), 'Foul');
  await app.subButton('Away').click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Who came in?');
  await subRow(page, 56).click();
  expect(await app.floorOf('Away')).toEqual(['55', '52', '53', '54', '56']); // D5: #56 is unpaired, so it sits in layout order
});

test("a row after the top five: its buttons and text stay readable on its lighter or darker fill, and Sub too (D1-D3)", async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  for (const [side, n] of [['Home', '16'], ['Away', '56']] as const) {
    const c = ui(page).half(side).getByRole('button', { name: new RegExp(`^#${n},`) });
    // The +2 and Foul borders against the rest row's fill: 3:1 for a control's edge (spec Accessibility).
    expect(await colorContrast(ui(page).quick2(side, n), 'borderTopColor', 'parent'), `${side} rest +2 border`).toBeGreaterThanOrEqual(3);
    expect(await colorContrast(ui(page).quickFoul(side, n), 'borderTopColor', 'parent'), `${side} rest Foul border`).toBeGreaterThanOrEqual(3);
    // Text at full strength: the number reads as on a solid row, and the gray points too (4.5:1 for text).
    expect(await contrast(c.getByText(n, { exact: true })), `${side} number`).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(c.getByText('0', { exact: true })), `${side} points`).toBeGreaterThanOrEqual(4.5);
    // The gray Sub button is readable too.
    await tap(page, ui(page).half(side).getByRole('button', { name: new RegExp(`^#${Number(n) - 1}(,| )`) }), '+2');
    const sub = ui(page).subButton(side);
    await expect(sub).not.toHaveClass(/amber/);
    expect(await colorContrast(sub, 'borderTopColor'), `${side} Sub border`).toBeGreaterThanOrEqual(3);
    expect(await contrast(sub), `${side} Sub text`).toBeGreaterThanOrEqual(4.5);
  }
});

test('a benched player in foul trouble: their rest-fill row keeps a readable amber ring and dots on both tones', async ({ page }) => {
  await twoTeamGame(page, { ours: 7, theirs: 7 });
  const app = ui(page);
  for (const n of ['10', '50']) {
    const side: Side = n === '10' ? 'Home' : 'Away';
    for (let i = 0; i < 4; i++) await tap(page, app.half(side).getByRole('button', { name: new RegExp(`^#${n}(,| )`) }), 'Foul');
  }
  // The 6th in for the 1st, each team.
  await seedSubs(page, [{ side: 'us', ins: [5], outs: [0] }, { side: 'them', ins: [5], outs: [0] }]);
  for (const [side, n] of [['Home', '10'], ['Away', '50']] as const) {
    const c = app.half(side).getByRole('button', { name: new RegExp(`^#${n},`) });
    await expect(app.row(side, n)).toHaveAccessibleName(`${side} #${n}, bench`);
    expect(await app.floorOf(side)).not.toContain(n);
    await expect(app.row(side, n)).toHaveClass(/ring-amber-/);
    expect(await colorContrast(app.row(side, n), 'ringColor'), `${side} rest warn ring`).toBeGreaterThanOrEqual(3);
    expect(await colorContrast(c.locator('span.rounded-full').first(), 'backgroundColor', 'parent'), `${side} rest warn dots`).toBeGreaterThanOrEqual(3);
  }
});

test('the strip: score home–away, team fouls per half, the bonus badge over the team that shoots', async ({ page }) => {
  await twoTeamGame(page, { ours: 5 });
  const app = ui(page);
  const strip = page.getByRole('banner');
  await app.opp(3);
  await expect(strip.getByLabel('Score Home 0, Away 3')).toBeVisible();
  for (let i = 0; i < 5; i++) await tap(page, card(page, String(10 + i), `Player ${i + 1}`), 'Foul');
  await expect(app.half('Home').getByText('Team fouls 5', { exact: true })).toBeVisible();
  await expect(app.half('Away').getByText('Team fouls 0', { exact: true })).toBeVisible();
  // Our 5th foul puts Away in the bonus: the badge names the team that shoots, over its half.
  const badge = strip.getByText('Away shoots', { exact: true });
  await expect(badge).toBeVisible();
  await expect(strip.getByText('Home shoots', { exact: true })).toHaveCount(0);
  const b = (await badge.boundingBox())!;
  const away = (await app.half('Away').boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(away.x);
  expect(b.x + b.width).toBeLessThanOrEqual(away.x + away.width);

  // On an away game the score still reads home–away: our +2 is the second number.
  await page.evaluate(() => localStorage.clear());
  await twoTeamGame(page, { away: true });
  await tap(page, card(page, '10', 'Player 1'), '+2');
  await expect(strip.getByLabel('Score Home 0, Away 2')).toBeVisible();
});

test("each half records for its own team: + Play, their cards, Bench and timeouts", async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  const home = app.half('Home');
  const away = app.half('Away');
  const dialog = page.getByRole('dialog');
  const toast = page.getByTestId('feedback-text');

  // + Play, No number: FT made goes back to the sheet for the pair, titled with the team.
  await away.getByRole('button', { name: '+ Play', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Away');
  await dialog.getByRole('button', { name: 'FT made', exact: true }).click();
  await dialog.getByRole('button', { name: 'No number', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Away');
  await expect(dialog.getByTestId('sheet-status')).toHaveText('Away FT made');
  // The second shot of the pair records at once for the team: no second Whose number?.
  await dialog.getByRole('button', { name: 'FT made', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Away');
  await expect(page.getByLabel('Score Home 0, Away 2')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  // A fresh + Play asks again: the pair ended with the sheet.
  await away.getByRole('button', { name: '+ Play', exact: true }).click();
  await dialog.getByRole('button', { name: 'FT missed', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Whose number?');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Score Home 0, Away 2')).toBeVisible();
  await tap(page, home.getByRole('button', { name: '+ Play', exact: true }), '+3', 'No number');
  await expect(toast).toHaveText('Home +3');
  await expect(page.getByLabel('Score Home 3, Away 2')).toBeVisible();

  // Their player's card takes the same sheet and credits them.
  await tap(page, away.getByRole('button', { name: /^#50,/ }), '+2');
  await expect(toast).toHaveText('#50 (Away) +2');
  await expect(away.getByRole('button', { name: /^#50,/ })).toHaveAccessibleName('#50, 2 points, 0 fouls, more plays');
  await expect(page.getByLabel('Score Home 3, Away 4')).toBeVisible();

  // Their bench tech counts to their team fouls, not ours.
  await app.benchTech('Away');
  await expect(toast).toHaveText('Away bench tech');
  // A tech on the card turns its dashed border amber (and only theirs).
  const awayBench = away.getByRole('button', { name: /^Bench \/ coach tech/ });
  await expect(awayBench).toHaveClass(/border-amber-400/);
  await expect(awayBench).toHaveCSS('border-top-color', 'oklch(0.828 0.189 84.429)'); // amber-400
  await expect(home.getByRole('button', { name: /^Bench \/ coach tech/ })).not.toHaveCSS('border-top-color', 'oklch(0.828 0.189 84.429)');
  await expect(away.getByText('Team fouls 1', { exact: true })).toBeVisible();
  await expect(home.getByText('Team fouls 0', { exact: true })).toBeVisible();

  // A timeout button takes that team's timeout in one tap.
  await app.timeout('Full', 'Away');
  await expect(toast).toHaveText('Away timeout (Full)');
  await expect(away.getByRole('button', { name: 'Full: 2', exact: true })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Full: 3', exact: true })).toBeVisible();
  // Undo puts it back.
  await page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(away.getByRole('button', { name: 'Full: 3', exact: true })).toBeVisible();
});

test('a game saved before 0.8, with opponent taps and no their roster, opens in the two halves', async ({ page }) => {
  const now = new Date().toISOString();
  const ev = (order: number, rest: object) => ({ id: `e${order}`, order, period: 1, enteredAt: now, ...rest });
  const legacy = {
    version: 1, id: 'legacy-game', currentPeriod: 1, periods: [], trackOpponentTaps: true, createdAt: now, updatedAt: now,
    info: { team: 'Test Home', opponent: 'Test Opp', date: now.slice(0, 10), homeAway: 'home', coach: '', scorer: '', timer: '' },
    roster: [{ id: 'p1', number: '4', name: 'Player One', pos: '' }],
    events: [ev(0, { type: 'FG2', playerId: 'p1' }), ev(1, { type: 'OPP_PTS', oppPoints: 3 }), ev(2, { type: 'OPP_PTS', oppPoints: 2 })],
  };
  await page.addInitScript((g) => localStorage.setItem('benchbook:game', JSON.stringify(g)), legacy);
  await page.goto('/');
  const away = ui(page).half('Away');
  await expect(page.getByRole('banner').getByLabel('Score Home 2, Away 5')).toBeVisible();
  await expect(away.getByRole('button', { name: /^#/ })).toHaveCount(0);
  await expect(away.getByRole('button', { name: '+ Play', exact: true })).toBeVisible();
  await expect(away.getByRole('button', { name: 'Bench / coach tech', exact: true })).toBeVisible();
  await expect(away.getByRole('button', { name: 'Full: 3', exact: true })).toBeVisible();
  // New points for them go through + Play and add to the old taps.
  await tap(page, away.getByRole('button', { name: '+ Play', exact: true }), '+2', 'No number');
  await expect(page.getByRole('banner').getByLabel('Score Home 2, Away 7')).toBeVisible();
});

test('a flashing row keeps a readable ring: the 4th foul by row Foul, on both tones', async ({ page }) => {
  // Spec Accessibility: rings at least 3:1 on every fill used, and spec "The row": the flash changes the
  // fill only, so the 4th-foul amber shows at once. Fake clock, paused, so the 400 ms flash holds while measured.
  await page.clock.install({ time: new Date('2026-11-24T18:00:00') });
  await page.clock.pauseAt(new Date('2026-11-24T18:00:01'));
  await twoTeamGame(page);
  const app = ui(page);
  for (const [side, n] of [['Home', '10'], ['Away', '50']] as const) {
    for (let i = 0; i < 4; i++) {
      await app.quickFoul(side, n).click();
      // Past the 400 ms double-tap window and the flash, except after the 4th tap.
      if (i < 3) await page.clock.runFor(500);
    }
    const row = app.row(side, n);
    await expect(row).toHaveAttribute('data-flash', '1');
    await expect(row).toHaveClass(/ring-amber-/);
    expect(await colorContrast(row, 'ringColor'), `${side} warn ring on the flash fill`).toBeGreaterThanOrEqual(3);
    await page.clock.runFor(500);
    await expect(row).not.toHaveAttribute('data-flash', '1');
    expect(await colorContrast(row, 'ringColor'), `${side} warn ring after the flash`).toBeGreaterThanOrEqual(3);
  }
});

test('light rows: warn and OUT stay readable', async ({ page }) => {
  const fouls = async (half: Locator, n: number) => {
    const c = half.getByRole('button', { name: /^#(10|50)(,| Player 1,)/ });
    for (let i = 0; i < n; i++) {
      await c.click();
      await page.getByRole('dialog').getByRole('button', { name: 'Foul', exact: true }).click();
    }
    return c;
  };
  // One game: Home's cards are light, Away's (their roster, #50) dark. Both get the same checks.
  await twoTeamGame(page);
  for (const side of ['Home', 'Away'] as const) {
    const half = ui(page).half(side);
    const c = await fouls(half, 4);
    // The 4-foul warning: the row's inset ring against the row, and the filled dots against the row.
    expect(await colorContrast(c.locator('..'), 'ringColor'), `${side} warn ring`).toBeGreaterThanOrEqual(3);
    expect(await colorContrast(c.locator('span.rounded-full').first(), 'backgroundColor', 'parent'), `${side} warn dots`).toBeGreaterThanOrEqual(3);
    // The team-fouls count turns to its warning color on the half's own background.
    await expect(half.getByText('Team fouls 4', { exact: true })).toBeVisible();
    expect(await contrast(half.getByText('Team fouls 4', { exact: true })), `${side} team fouls`).toBeGreaterThanOrEqual(4.5);
    // A bench tech turns the Bench card's border amber (and its count text).
    await ui(page).benchTech(side);
    const bench = half.getByRole('button', { name: /^Bench \/ coach tech/ });
    expect(await colorContrast(bench, 'borderTopColor'), `${side} bench border`).toBeGreaterThanOrEqual(3);
    expect(await contrast(half.getByTestId('bench-techs')), `${side} bench text`).toBeGreaterThanOrEqual(4.5);
    // The 5th foul: OUT is readable and its red ring keeps full strength; OUT takes the dots' place (spec "The row").
    await fouls(half, 1);
    const out = half.getByRole('button', { name: /, out, more plays$/ });
    expect(await contrast(out.getByText('OUT', { exact: true })), `${side} OUT text`).toBeGreaterThanOrEqual(4.5);
    expect(await colorContrast(out.locator('..'), 'ringColor'), `${side} out ring`).toBeGreaterThanOrEqual(3);
    await expect(out.locator('span.rounded-full')).toHaveCount(0);
  }
});

// ---- Live sheets: + Play and Whose number?, Stop asking, the zero-timeout guard -------------

const plusPlay = (page: Page, side: Side) => ui(page).half(side).getByRole('button', { name: '+ Play', exact: true });
const cards = (page: Page, side: Side, n: string) => ui(page).half(side).getByRole('button', { name: new RegExp(`^#${n}(,| )`) });

/** + Play, a play, then the Whose number? sheet (left open). */
async function plusPlayAsk(page: Page, side: Side, play: string) {
  await plusPlay(page, side).click();
  await page.getByRole('dialog').getByRole('button', { name: play, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Whose number?');
}

test("a player card's sheet is titled with its team, and the strip's score says whose", async ({ page }) => {
  await twoTeamGame(page);
  const dialog = page.getByRole('dialog');
  await card(page, '10', 'Player 1').click();
  await expect(dialog).toHaveAccessibleName('#10 Player 1 (Home)');
  await dialog.getByRole('button', { name: '+2', exact: true }).click();
  await ui(page).half('Away').getByRole('button', { name: /^#50,/ }).click();
  await expect(dialog).toHaveAccessibleName('#50 (Away)');
  await dialog.getByRole('button', { name: '+3', exact: true }).click();
  await expect(page.getByRole('banner').getByLabel('Score Home 2, Away 3', { exact: true })).toBeVisible();
});

test('+ Play, then a new number: the player joins that team and takes the play; a known number is credited', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  const toast = page.getByTestId('feedback-text');

  // Their #33 is new: Save adds the card and credits the +2.
  await plusPlayAsk(page, 'Away', '+2');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await dialog.getByLabel('Number', { exact: true }).fill('33');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toast).toHaveText('#33 (Away) +2');
  await expect(cards(page, 'Away', '33')).toHaveAccessibleName('#33, 2 points, 0 fouls, more plays');
  await expect(page.getByLabel('Score Home 0, Away 2', { exact: true })).toBeVisible();

  // #33 again is the same player: a foul on the card, no second #33.
  await plusPlayAsk(page, 'Away', 'Foul');
  await dialog.getByLabel('Number', { exact: true }).fill(' 33 ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(cards(page, 'Away', '33')).toHaveCount(1);
  await expect(cards(page, 'Away', '33')).toHaveAccessibleName('#33, 2 points, 1 foul, more plays');
  await expect(app.half('Away').getByText('Team fouls 1', { exact: true })).toBeVisible();

  // Ours too: Home's + Play adds our #22, and one Undo takes back both the play and the card.
  await plusPlayAsk(page, 'Home', '+3');
  await dialog.getByLabel('Number', { exact: true }).fill('22');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast).toHaveText('#22 (Home) +3');
  await expect(cards(page, 'Home', '22')).toHaveAccessibleName('#22, 3 points, 0 fouls, more plays');
  await expect(app.half('Away').getByRole('button', { name: /^#22/ })).toHaveCount(0);
  await app.undo();
  await expect(cards(page, 'Home', '22')).toHaveCount(0);
  await expect(page.getByLabel('Score Home 0, Away 2', { exact: true })).toBeVisible();

  // A free throw with a new number goes on to that player's sheet, for the second shot.
  await plusPlayAsk(page, 'Away', 'FT made');
  await dialog.getByLabel('Number', { exact: true }).fill('41');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('#41 (Away)');
  await expect(dialog.getByTestId('sheet-status')).toHaveText('#41 (Away) FT made');
  await dialog.getByRole('button', { name: 'FT made', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(cards(page, 'Away', '41')).toHaveAccessibleName('#41, 2 points, 0 fouls, more plays');
});

test('Whose number? keeps a team to 15 players, and closing it records nothing', async ({ page }) => {
  await twoTeamGame(page, { theirs: 15 });
  const dialog = page.getByRole('dialog');
  await plusPlayAsk(page, 'Away', '+2');
  await dialog.getByLabel('Number', { exact: true }).fill('99');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('At most 15 players.');
  await expect(cards(page, 'Away', '99')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Score Home 0, Away 0', { exact: true })).toBeVisible();
});

test('+ Play, No number: their score and team fouls only, no player', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  const toast = page.getByTestId('feedback-text');
  await plusPlayAsk(page, 'Away', '+2');
  await dialog.getByRole('button', { name: 'No number', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toast).toHaveText('Away +2');
  await expect(page.getByLabel('Score Home 0, Away 2', { exact: true })).toBeVisible();
  await expect(app.half('Away').getByRole('button', { name: /^#/ })).toHaveCount(2);
  // A foul with no number: Away's team fouls, and at the 5th the toast says bonus.
  for (let i = 0; i < 5; i++) {
    await plusPlayAsk(page, 'Away', 'Foul');
    await dialog.getByRole('button', { name: 'No number', exact: true }).click();
  }
  await expect(toast).toHaveText('Away Foul — bonus');
  await expect(app.half('Away').getByText('Team fouls 5', { exact: true })).toBeVisible();
  await expect(app.half('Home').getByText('Team fouls 0', { exact: true })).toBeVisible();
  for (const n of ['50', '51']) await expect(cards(page, 'Away', n)).toHaveAccessibleName(`#${n}, 0 points, 0 fouls, more plays`);
});

test('Stop asking this game: that team only, kept on the game through a reload', async ({ page }) => {
  await twoTeamGame(page);
  const dialog = page.getByRole('dialog');
  const toast = page.getByTestId('feedback-text');
  await plusPlayAsk(page, 'Away', '+3');
  await dialog.getByRole('button', { name: 'Stop asking this game', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toast).toHaveText('Away +3');
  // Their next + Play records in two taps.
  await tap(page, plusPlay(page, 'Away'), '+2');
  await expect(toast).toHaveText('Away +2');
  await expect(page.getByLabel('Score Home 0, Away 5', { exact: true })).toBeVisible();
  await page.reload();
  await tap(page, plusPlay(page, 'Away'), '+2');
  await expect(page.getByLabel('Score Home 0, Away 7', { exact: true })).toBeVisible();
  // Ours still asks.
  await plusPlayAsk(page, 'Home', '+2');
});

test("their foul-out: 5 fouls on their #50 — OUT on the card and the out warning on its sheet", async ({ page }) => {
  await twoTeamGame(page);
  const c = ui(page).half('Away').getByRole('button', { name: /^#50,/ });
  for (let i = 0; i < 5; i++) await tap(page, c, 'Foul');
  await expect(page.getByTestId('feedback-text')).toHaveText('#50 (Away) out, 5 fouls — bonus. Tell the official.');
  await expect(c).toHaveAccessibleName('#50, 0 points, 5 fouls, out, more plays');
  await c.click();
  await expect(page.getByRole('dialog').getByTestId('out-warning')).toContainText('Out: 5 fouls.');
  await expect(page.getByRole('dialog').getByRole('button', { name: '+2', exact: true })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  // Typing an out player's number at Whose number? opens their sheet, warning first: nothing is recorded yet.
  await plusPlayAsk(page, 'Away', '+2');
  await page.getByRole('dialog').getByLabel('Number', { exact: true }).fill('50');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('#50 (Away)');
  await expect(page.getByRole('dialog').getByTestId('out-warning')).toBeVisible();
  await expect(page.getByLabel('Score Home 0, Away 0', { exact: true })).toBeVisible();
});

test('the same number on both teams: each card and each toast is its own', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Player 1 number', { exact: true }).fill('4');
  await ui(page).fillOppRoster([{ number: '4' }]);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const toast = page.getByTestId('feedback-text');
  await tap(page, cards(page, 'Home', '4'), '+2');
  await expect(toast).toHaveText('#4 (Home) +2');
  await tap(page, cards(page, 'Away', '4'), '+2');
  await expect(toast).toHaveText('#4 (Away) +2');
  await expect(cards(page, 'Home', '4')).toHaveAccessibleName('#4, 2 points, 0 fouls, more plays');
  await expect(cards(page, 'Away', '4')).toHaveAccessibleName('#4, 2 points, 0 fouls, more plays');
});

test('a timeout at zero is guarded: grayed, a warning, Cancel records nothing, Take one anyway records it', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 3; i++) await app.timeout('Full', 'Away');
  const zero = app.half('Away').getByRole('button', { name: 'Full: 0', exact: true });
  await expect(zero).toHaveClass(/opacity-50/);
  const logged = async () => {
    await app.openLog();
    const n = await page.getByRole('button', { name: /^Away timeout \(Full\)/ }).count();
    await app.back();
    return n;
  };
  expect(await logged()).toBe(3);
  await zero.click();
  await expect(dialog).toContainText('Away has no full timeouts left. Are you sure?');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await logged()).toBe(3);
  await zero.click();
  await dialog.getByRole('button', { name: 'Take one anyway', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('feedback-text')).toHaveText('Away timeout (Full)');
  await expect(zero).toBeVisible(); // still Full: 0, never below
  expect(await logged()).toBe(4);
  // Home's are untouched and still take one tap.
  await app.timeout('Full', 'Home');
  await expect(app.half('Home').getByRole('button', { name: 'Full: 2', exact: true })).toBeVisible();
});

test('fix sheet: a play entered on the wrong team moves to the other team', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  await tap(page, app.half('Away').getByRole('button', { name: /^#50,/ }), '+2');
  await expect(page.getByLabel('Score Home 0, Away 2')).toBeVisible();
  await app.openLog();
  const row = app.logRow(page.locator('body'), '#50 (Away) · +2');
  await row.click();
  const sheet = page.getByRole('dialog');
  // Team sits above Player; Away is the current team.
  await expect(sheet.getByRole('group', { name: 'Team' }).getByRole('button', { name: 'Away', exact: true })).toHaveClass(/bg-white/);
  await sheet.getByRole('group', { name: 'Team' }).getByRole('button', { name: 'Home', exact: true }).click();
  // The old player is gone with the old team: Save waits for a pick, and No number is offered.
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(sheet.getByRole('group', { name: 'Player' }).getByRole('button', { name: 'No number', exact: true })).toBeVisible();
  await sheet.getByRole('group', { name: 'Player' }).getByRole('button', { name: /^#10 Player 1/ }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(app.logRow(page.locator('body'), '#10 Player 1 (Home) · +2')).toBeVisible();
  await expect(page.getByTestId('feedback-text')).toHaveText('Edited #50 (Away) +2 → #10 (Home) +2');
  await app.back();
  await expect(page.getByLabel('Score Home 2, Away 0')).toBeVisible();
  // One Undo reverts the whole team move.
  await page.getByRole('navigation').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Score Home 0, Away 2')).toBeVisible();
});

test('fix sheet: a no-number play reads as the team and can move with No number', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  await app.opp(2);
  await app.openLog();
  await app.logRow(page.locator('body'), 'Away · +2').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('group', { name: 'Player' }).getByRole('button', { name: 'No number', exact: true })).toHaveClass(/bg-white/);
  await sheet.getByRole('group', { name: 'Team' }).getByRole('button', { name: 'Home', exact: true }).click();
  await sheet.getByRole('group', { name: 'Player' }).getByRole('button', { name: 'No number', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(app.logRow(page.locator('body'), 'Home · +2')).toBeVisible();
  await app.back();
  await expect(page.getByLabel('Score Home 2, Away 0')).toBeVisible();
});

// ---- The quarter check: their score warns, both teams' fouls ------------------------------------

test('check: their score off warns but the quarter still saves as matched', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  await card(page, '10', 'Player 1').click();
  await page.getByRole('dialog').getByRole('button', { name: '+2', exact: true }).click();
  await cards(page, 'Away', '50').click();
  await page.getByRole('dialog').getByRole('button', { name: '+3', exact: true }).click();
  await app.endPeriod('Q1');
  await app.banner('Q1').click();
  await ui(page).expectBlankScoreBoxes('Q1'); // 0.12.3: no "from the app" hint; the app's 3 is in the line above
  await expect(page.getByTestId('app-has')).toHaveText('App after Q1: Us 2 · Them 3 (Q1: 2–3)');
  await app.fillCheck('Q1', 2, 5);
  const line = page.getByTestId('compare-opp');
  await expect(line).toHaveText('Their score: book 5 · app 3 — 2 off');
  await expect(line).toHaveClass(/text-amber/);
  // Ours matches, but the panel is not the green "✓ Matches": theirs is off, so it is amber and says so.
  const compare = page.getByTestId('compare');
  await app.expectMatches('Ours matches · theirs 2 off');
  await expect(compare.locator('..')).toHaveClass(/bg-amber-400/);
  await expect(compare.locator('..')).not.toHaveClass(/bg-emerald/);
  // With their box fixed to the app's 3, it is the green match again.
  await page.getByLabel(/Their game score after Q1/).fill('3');
  await app.expectMatches();
  await expect(compare.locator('..')).toHaveClass(/bg-emerald-800/);
  // ...and blank, as today: green.
  await page.getByLabel(/Their game score after Q1/).fill('');
  await app.expectMatches();
  await expect(compare.locator('..')).toHaveClass(/bg-emerald-800/);
  await page.getByLabel(/Their game score after Q1/).fill('5');
  await app.expectMatches('Ours matches · theirs 2 off');
  await app.saveCheck();
  // The quarter's status follows our score: the toast is the matched one.
  await app.expectToast('Saved Q1 check');
  await app.openLog();
  await expect(app.chip('Q1', 'matched')).toBeVisible();
  await app.back();
  await app.openEnd();
  await expect(page.getByTestId('final-us')).toBeVisible();
  await expect(app.issues()).toHaveCount(0);
});

test('check: saving a quarter whose score is still off says the gap in the toast', async ({ page }) => {
  await onePlayerGame(page);
  const app = ui(page);
  await tap(page, card(page, '4', 'Player One'), '+2');
  await app.endPeriod('Q1');
  await app.banner('Q1').click();
  await page.getByLabel(/Our game score after Q1/).fill('4');
  await app.expectShort('Q1', 4, 2, 2);
  await app.saveCheck();
  await app.expectToast('Saved Q1 check — app still 2 short');
});

test('check: when the other team has plays, both teams get their quarter and whole-game fouls', async ({ page }) => {
  await twoTeamGame(page);
  const app = ui(page);
  await tap(page, card(page, '10', 'Player 1'), 'Foul');
  await tap(page, cards(page, 'Away', '50'), 'Foul');
  await tap(page, cards(page, 'Away', '50'), 'Foul');
  await app.endPeriod('Q1');
  await app.banner('Q1').click();
  await expect(page.getByText(/^Team fouls in Q1 \(Home\):/)).toHaveText('Team fouls in Q1 (Home): 1');
  await expect(page.getByText(/^Team fouls in Q1 \(Away\):/)).toHaveText('Team fouls in Q1 (Away): 2');
  await expect(page.getByRole('list', { name: 'Home player fouls, whole game' }).getByRole('listitem')).toHaveText(['#10 Player 11', '#11 Player 20']);
  await expect(page.getByRole('list', { name: 'Away player fouls, whole game' }).getByRole('listitem')).toHaveText(['#50 2', '#51 0']);
});
