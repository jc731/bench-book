import { expect, test, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { OPPONENT, TEAM, ui } from './fixture';

/*
 * Book (0.11, spec 2026-11-19 D1-D8, I3): the bottom bar's Book opens a Players tab (points and
 * fouls by quarter, Home | Away) and a Plays tab (the old Log). Invented names only; nothing here
 * imports from src/. Expected values are worked by hand from the plays recorded in each test.
 */
const exact = (name: string) => ({ name, exact: true });
const nav = (page: Page) => page.getByRole('navigation');
const grid = (page: Page) => page.getByTestId('stats-grid');
const row = (page: Page, name: string) => grid(page).getByRole('row', exact(name));

/** Home: the fixture roster (#4 Player One...). Away: #10 Rival Ten, #22 Rival Two. */
async function startGame(page: Page) {
  const app = ui(page);
  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  await app.fillOppRoster([{ number: '10', name: 'Rival Ten' }, { number: '22', name: 'Rival Two' }]);
  await app.startGame();
  return app;
}

test('Book: Players grid by quarter for each team, Plays is the Log, and the choices stick (D1-D7, I3)', async ({ page }) => {
  const app = await startGame(page);
  // Q1: Home #4 +2 and a Foul; Away #10 +3. Score 2-3.
  await app.score('Player One', '+2');
  await app.foul('Player One');
  await app.half('Away').getByRole('button', { name: /^#10(,| )/ }).click();
  await page.getByRole('dialog').getByRole('button', exact('+3')).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The bottom bar reads Book (D1).
  await nav(page).getByRole('button', exact('Book')).click();
  await expect(page.getByRole('heading', exact('Book'))).toBeVisible();
  // D1: Players is selected; D2: Home is selected, and each toggle shows the team name and score.
  await expect(page.getByRole('tab', exact('Players'))).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', exact('Plays'))).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('button', exact(`${TEAM} 2`))).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', exact(`${OPPONENT} 3`))).toHaveAttribute('aria-pressed', 'false');

  // D6: #4's Q1 is 2 points over one foul dot; Q2 has nothing (a faint ·).
  const one = row(page, '#4 Player One');
  const q1 = one.getByRole('cell', { name: /^Q1/ });
  await expect(q1).toHaveAccessibleName('Q1: 2 points, 1 foul');
  await expect(q1).toHaveText('2');
  await expect(q1.getByTestId('foul-dot')).toHaveCount(1);
  await expect(one.getByRole('cell', { name: /^Q2/ })).toHaveText('·');
  // D7: the total is 2, then F 1.
  const total = one.getByRole('cell', { name: /^Total/ });
  await expect(total.getByText('2', { exact: true })).toBeVisible();
  await expect(total.getByText('F 1', { exact: true })).toBeVisible();
  // D4: the Team row's Q1 is 2 points with 1 team foul; the Score row's Q1 is Home-Away 2-3 (I3).
  await expect(row(page, 'Team').getByRole('cell', { name: /^Q1/ })).toHaveAccessibleName('Q1: 2 points, 1 foul');
  await expect(row(page, 'Score').getByRole('cell', { name: /^Q1/ })).toHaveText('2–3');

  // D3: Q1-Q4 fit 390px with no sideways scroll.
  expect(await grid(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(grid(page).getByRole('columnheader')).toHaveText(['Player', 'Q1', 'Q2', 'Q3', 'Q4', 'Total']);

  // D2: Away shows #10's +3 in Q1.
  await page.getByRole('button', exact(`${OPPONENT} 3`)).click();
  await expect(row(page, '#10 Rival Ten').getByRole('cell', { name: /^Q1/ })).toHaveText('3');
  await expect(row(page, '#10 Rival Ten').getByRole('cell', { name: /^Q1/ })).toHaveAccessibleName('Q1: 3 points, 0 fouls');

  // Plays is the Log list (D1).
  await page.getByRole('tab', exact('Plays')).click();
  const plays = page.getByRole('region', exact('Q1')).getByRole('button');
  await expect(plays).toHaveCount(3);
  await expect(plays.first()).toHaveAccessibleName('#10 Rival Ten (Away) · +3');

  // D1, D2: leave and come back; Plays and Away are still chosen.
  await page.getByRole('button', exact('Back')).click();
  await nav(page).getByRole('button', exact('Book')).click();
  await expect(page.getByRole('tab', exact('Plays'))).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', exact('Players')).click();
  await expect(page.getByRole('button', exact(`${OPPONENT} 3`))).toHaveAttribute('aria-pressed', 'true');
});

test('Book: quarters not yet started are drawn but not tappable (controller ruling, D9)', async ({ page }) => {
  const app = await startGame(page);
  await app.score('Player One', '+2');
  await nav(page).getByRole('button', exact('Book')).click();
  const one = row(page, '#4 Player One');
  // In Q1, Q1 is open to adds (Task 4) and Q2-Q4 are not.
  await expect(one.getByRole('cell', { name: /^Q1/ })).toHaveAttribute('data-tappable', 'true');
  for (const q of ['Q2', 'Q3', 'Q4']) await expect(one.getByRole('cell', { name: new RegExp(`^${q}`) })).toHaveAttribute('data-tappable', 'false');
  // The footer rows are never tappable (D9).
  await expect(row(page, 'Team').getByRole('cell', { name: /^Q1/ })).not.toHaveAttribute('data-tappable', 'true');
});

// ---- The cell sheet (Task 4: D9-D14, I5, I6; plan critique 3, 4, 6; Review Focus 5) ----------

const dialog = (page: Page) => page.getByRole('dialog');
/** A quarter cell of a player row, by its label (`Q2`). */
const cell = (page: Page, rowName: string, q: string) => row(page, rowName).getByRole('cell', { name: new RegExp(`^${q}:`) });
/** The cell sheet's own feedback line. */
const sheetLine = (page: Page) => dialog(page).getByTestId('cell-feedback');
const PLAYS = ['+2', '+3', 'FT made', 'FT missed', 'Foul', 'Tech foul'];

/** Four fouls for #4 Player One in Q1 (on the floor: the first five start), then `ends` quarters ended. */
async function fourFoulsThen(page: Page, ends: number) {
  const app = await startGame(page);
  for (let i = 0; i < 4; i++) await app.foul('Player One');
  const labels = ['Q1', 'Q2', 'Q3'];
  for (let i = 0; i < ends; i++) await app.endPeriod(labels[i]);
  return app;
}

test('Cell sheet: a missed 5th foul added to Q2 from Q4 puts #4 out, says tell the official, and moves no one onto the floor (D9, D11, D12, I5)', async ({ page }) => {
  const app = await fourFoulsThen(page, 3); // now in Q4
  const floorBefore = await app.floorOf('Home');
  expect(floorBefore).toEqual(['4', '00', '0', '12', '23']); // the first five start (sub rules, 0.9)

  await nav(page).getByRole('button', exact('Book')).click();
  await cell(page, '#4 Player One', 'Q2').click();
  // D9: the title names the player, team and quarter.
  await expect(dialog(page)).toHaveAccessibleName('#4 Player One (Home) · Q2');
  await expect(dialog(page).getByTestId('cell-summary')).toHaveText('Q2: 0 points, 0 fouls · Game: 0 points, 4 fouls');
  await expect(dialog(page).getByText('Add to Q2', { exact: true })).toBeVisible();
  await dialog(page).getByRole('button', exact('Foul')).click();

  // D12: the live out text, in red; D9: the sheet stays open and lists the play.
  await expect(sheetLine(page)).toHaveText('#4 Player One (Home) out, 5 fouls. Tell the official.');
  await expect(sheetLine(page)).toHaveAttribute('data-tone', 'red');
  await expect(dialog(page)).toHaveAccessibleName('#4 Player One (Home) · Q2');
  await expect(dialog(page).getByRole('list', exact('Plays')).getByRole('button')).toHaveText([/^#4 Player One \(Home\) · Foul/]);
  // Critique 6: the out warning shows at once, the red line is whole at 390x664, Undo is in view.
  await expect(dialog(page).getByTestId('out-warning')).toContainText('Out: 5 fouls.');
  for (const p of PLAYS) await expect(dialog(page).getByRole('button', exact(p))).toBeDisabled();
  expect(await sheetLine(page).evaluate((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
  await expect(sheetLine(page)).toBeInViewport({ ratio: 1 });
  await expect(dialog(page).getByRole('button', exact('Undo'))).toBeInViewport({ ratio: 1 });

  await dialog(page).getByRole('button', exact('Done')).click();
  await expect(dialog(page)).toHaveCount(0);
  // D7: the total reads OUT.
  await expect(row(page, '#4 Player One').getByRole('cell', { name: /^Total/ }).getByText('OUT', { exact: true })).toBeVisible();
  // I5: on Live #4 is out and off the floor, and no bench player took the place.
  await app.back();
  await app.expectPlayer('Player One', 0, 5, true);
  expect(await app.floorOf('Home')).toEqual(['00', '0', '12', '23']);
});

test('Cell sheet: Undo in the sheet takes back the last add and unlocks the plays (D10, critique 6)', async ({ page }) => {
  await fourFoulsThen(page, 1); // now in Q2
  await nav(page).getByRole('button', exact('Book')).click();
  await cell(page, '#4 Player One', 'Q1').click();
  // The four Q1 fouls are listed, oldest first (D9).
  await expect(dialog(page).getByRole('list', exact('Plays')).getByRole('button')).toHaveCount(4);
  await dialog(page).getByRole('button', exact('Foul')).click();
  await expect(sheetLine(page)).toHaveText('#4 Player One (Home) out, 5 fouls. Tell the official.');
  await expect(dialog(page).getByRole('list', exact('Plays')).getByRole('button')).toHaveCount(5);
  await expect(dialog(page).getByRole('button', exact('Foul'))).toBeDisabled();

  // D10: one add is one undo step.
  await dialog(page).getByRole('button', exact('Undo')).click();
  await expect(sheetLine(page)).toHaveText('Undid #4 Player One (Home) out, 5 fouls. Tell the official.');
  await expect(sheetLine(page)).toHaveAttribute('data-tone', 'plain');
  await expect(dialog(page).getByRole('list', exact('Plays')).getByRole('button')).toHaveCount(4);
  await expect(dialog(page).getByTestId('out-warning')).toHaveCount(0);
  for (const p of PLAYS) await expect(dialog(page).getByRole('button', exact(p))).toBeEnabled();
  await dialog(page).getByRole('button', exact('Done')).click();
  await expect(cell(page, '#4 Player One', 'Q1')).toHaveAccessibleName('Q1: 0 points, 4 fouls');
});

test('Cell sheet: a late +2 for a bench player stays on the bench (D11); a listed play opens the fix sheet (D9)', async ({ page }) => {
  const app = await startGame(page);
  await app.score('Player One', '+2');
  await app.endPeriod('Q1'); // now in Q2
  await nav(page).getByRole('button', exact('Book')).click();
  // #31 Player Six is on the bench (the sixth player); a late +2 in Q1.
  await cell(page, '#31 Player Six', 'Q1').click();
  await dialog(page).getByRole('button', exact('+2')).click();
  await expect(sheetLine(page)).toHaveText('Added #31 (Home) +2 to Q1'); // D12 base wording
  await expect(sheetLine(page)).toHaveAttribute('data-tone', 'plain');
  await dialog(page).getByRole('button', exact('Done')).click();
  await expect(cell(page, '#31 Player Six', 'Q1')).toHaveAccessibleName('Q1: 2 points, 0 fouls');

  // D9: a listed play opens the Log's fix sheet; +2 to +3 updates the cell.
  await cell(page, '#4 Player One', 'Q1').click();
  await dialog(page).getByRole('list', exact('Plays')).getByRole('button', { name: /^#4 Player One \(Home\) · \+2/ }).click();
  await expect(dialog(page).getByRole('group', exact('Play'))).toBeVisible();
  await dialog(page).getByRole('group', exact('Play')).getByRole('button', exact('+3')).click();
  await dialog(page).getByRole('button', exact('Save')).click();
  // Back on the cell sheet, which lists the changed play.
  await expect(dialog(page)).toHaveAccessibleName('#4 Player One (Home) · Q1');
  await expect(dialog(page).getByRole('list', exact('Plays')).getByRole('button')).toHaveText([/^#4 Player One \(Home\) · \+3/]);
  await dialog(page).getByRole('button', exact('Done')).click();
  await expect(cell(page, '#4 Player One', 'Q1')).toHaveAccessibleName('Q1: 3 points, 0 fouls');

  // D11, I5: back on Live, #31 is still on the bench.
  await app.back();
  expect(await app.floorOf('Home')).toEqual(['4', '00', '0', '12', '23']);
});

test('Cell sheet: an opponent add names their team (D9, D12, critique 6)', async ({ page }) => {
  await startGame(page);
  await nav(page).getByRole('button', exact('Book')).click();
  await page.getByRole('button', exact(`${OPPONENT} 0`)).click();
  await cell(page, '#10 Rival Ten', 'Q1').click();
  await expect(dialog(page)).toHaveAccessibleName('#10 Rival Ten (Away) · Q1');
  await dialog(page).getByRole('button', exact('+2')).click();
  await expect(sheetLine(page)).toHaveText('Added #10 (Away) +2 to Q1'); // D12 base wording
  await dialog(page).getByRole('button', exact('Done')).click();
  await expect(cell(page, '#10 Rival Ten', 'Q1')).toHaveAccessibleName('Q1: 2 points, 0 fouls');
  await expect(page.getByRole('button', exact(`${OPPONENT} 2`))).toHaveAttribute('aria-pressed', 'true');
});

test('Cell sheet: a player already out is behind the out warning until "Enter a play anyway" (Review Focus 5)', async ({ page }) => {
  const app = await startGame(page);
  for (let i = 0; i < 5; i++) await app.foul('Player One');
  await nav(page).getByRole('button', exact('Book')).click();
  await cell(page, '#4 Player One', 'Q1').click();
  await expect(dialog(page).getByTestId('out-warning')).toContainText('Out: 5 fouls. Are you sure? This player is supposed to be out.');
  for (const p of PLAYS) await expect(dialog(page).getByRole('button', exact(p))).toBeDisabled();
  await dialog(page).getByRole('button', exact('Enter a play anyway')).click();
  for (const p of PLAYS) await expect(dialog(page).getByRole('button', exact(p))).toBeEnabled();
  await dialog(page).getByRole('button', exact('+2')).click();
  await expect(sheetLine(page)).toHaveText('Added #4 (Home) +2 to Q1');
});

test('Cell sheet: an add to an ended game keeps it ended and clears the export mark (D13, I6)', async ({ page }) => {
  const app = await startGame(page);
  await app.score('Player One', '+2');
  await app.endPeriod('Q1');
  await app.endPeriod('Q2');
  await app.endPeriod('Q3');
  await app.endPeriodThen('Q4', 'End game (no overtime)'); // opens Final
  await app.exportButton('Book CSV').click();
  await app.exportButton('Plays CSV').click();
  await app.expectExportState(true, true);
  await app.backToLive();

  await nav(page).getByRole('button', exact('Book')).click();
  await cell(page, '#4 Player One', 'Q3').click();
  await dialog(page).getByRole('button', exact('Foul')).click();
  await expect(sheetLine(page)).toHaveText('Added #4 (Home) Foul to Q3');
  await dialog(page).getByRole('button', exact('Done')).click();
  await app.back();
  // I6: still ended (the End slot reads Final), and the files no longer hold the game.
  await expect(nav(page).getByRole('button', { name: /^Final/ })).toBeVisible();
  await app.openEnd();
  await app.expectExportState(false, false);
  await expect(page.getByRole('button', exact('Reopen game'))).toBeVisible();
});

test('The check\'s Add play: a 5th foul says tell the official, a late add stays on the bench, and both count as late adds (critique 3, D11, D14)', async ({ page }) => {
  const app = await fourFoulsThen(page, 1); // now in Q2
  await app.banner('Q1').click();
  await app.fixRegion().getByRole('button', exact('Add play to Q1')).click();
  await dialog(page).getByRole('button', exact('#4 Player One')).click();
  await dialog(page).getByRole('button', exact('Foul')).click();
  await expect(dialog(page)).toHaveCount(0);
  await app.expectToast('#4 Player One (Home) out, 5 fouls. Tell the official.');
  // Review Focus 5 / critique 3: the check's sheet has the same out gate.
  await app.fixRegion().getByRole('button', exact('Add play to Q1')).click();
  await dialog(page).getByRole('button', exact('#4 Player One')).click();
  await expect(dialog(page).getByTestId('out-warning')).toContainText('Out: 5 fouls.');
  await expect(dialog(page).getByRole('button', exact('+2'))).toBeDisabled();
  await page.keyboard.press('Escape');
  // A late +2 for bench #31 from the check (audit 0.9.0 F1, D11).
  await app.addPlay('Q1', 'Player Six', '+2');
  await app.later();
  expect(await app.floorOf('Home')).toEqual(['00', '0', '12', '23']); // #4 out, #31 not promoted (I5)

  // D14: both check adds are late adds; the four live fouls are the plays.
  await app.openEnd();
  const rows = await downloadCsv(page, page.getByRole('button', exact('Usage CSV')));
  const v = (k: string) => Number(rows[1][rows[0].indexOf(k)]);
  expect(v('late_adds')).toBe(2);
  expect(v('plays')).toBe(4);
});

test('Cell sheet: usage counts a late add as a late add and a current-quarter add as a play (D14)', async ({ page }) => {
  const app = await startGame(page);
  await app.score('Player One', '+2'); // plays 1 (live)
  await app.endPeriod('Q1'); // now in Q2
  await nav(page).getByRole('button', exact('Book')).click();
  await cell(page, '#4 Player One', 'Q1').click();
  await dialog(page).getByRole('button', exact('+2')).click(); // late: Q1 < Q2
  await dialog(page).getByRole('button', exact('Done')).click();
  await cell(page, '#4 Player One', 'Q2').click();
  await dialog(page).getByRole('button', exact('+3')).click(); // the current quarter: a play
  await expect(sheetLine(page)).toHaveText('Added #4 (Home) +3 to Q2');
  await dialog(page).getByRole('button', exact('Done')).click();
  await app.back();
  await app.openEnd();
  const rows = await downloadCsv(page, page.getByRole('button', exact('Usage CSV')));
  const v = (k: string) => Number(rows[1][rows[0].indexOf(k)]);
  expect(v('late_adds')).toBe(1);
  expect(v('plays')).toBe(2); // the live +2 and the Q2 add
});
