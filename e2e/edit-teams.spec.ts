import { expect, test, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { OPPONENT, TEAM, ui } from './fixture';

/*
 * Task 5: Edit teams (design 2026-11-19, D10-D14, I1 and I6). Invented names only; nothing here
 * imports from src/.
 */
const exact = (name: string) => ({ name, exact: true });
const half = (page: Page, side: 'Home' | 'Away') => page.getByRole('region', exact(side));

async function openEditTeams(page: Page) {
  await page.getByRole('navigation').getByRole('button', exact('More')).click();
  await page.getByRole('dialog').getByRole('button', exact('Edit teams')).click();
  await expect(page.getByRole('heading', exact('Edit teams'))).toBeVisible();
}

async function startScoredGame(page: Page) {
  const app = ui(page);
  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  // Numbers only, as Whose number? would leave them (Review Focus 2).
  await app.fillOppRoster([{ number: '2' }, { number: '3' }]);
  await app.startGame();
  await app.score('Player One', '+2');
  return app;
}

test('Edit teams: rename a player with plays, add #33 to theirs, Save; Undo restores (D10-D14, I6)', async ({ page }) => {
  const app = await startScoredGame(page);
  await openEditTeams(page);

  // D14: the scored player (row 1, Player One) can't be removed and says why.
  await expect(page.getByRole('button', exact('Remove player 1'))).toBeDisabled();
  await expect(page.getByText('has plays', { exact: true })).toHaveCount(1);
  // D14 floor lock (fix round 1): a starter with no plays (row 2) is locked too, "on the floor": our
  // other four starters and both of theirs (#2, #3, a roster under five). A bench player (row 6) is not.
  await expect(page.getByRole('button', exact('Remove player 2'))).toBeDisabled();
  await expect(page.getByRole('button', exact('Remove player 2'))).toHaveAccessibleDescription('on the floor');
  await expect(page.getByText('on the floor', { exact: true })).toHaveCount(6);
  await expect(page.getByRole('button', exact('Remove player 6'))).toBeEnabled();

  await page.getByLabel('Player 1 name', { exact: true }).fill('Player Uno');
  await page.getByRole('button', exact('Add their player')).click();
  await page.getByLabel('Their player 3 number', { exact: true }).fill('33');
  await page.getByRole('button', exact('Save')).click();

  // Back on Live: the new name keeps the play (D12: same player id), #33 has a card (D13: appended).
  await expect(half(page, 'Home').getByRole('button', { name: /^#4 Player Uno, 2 points, 0 fouls/ })).toBeVisible();
  await expect(half(page, 'Away').getByRole('button', { name: /^#33, 0 points/ })).toBeVisible();
  await app.expectToast('Edited teams'); // D11: one undoable entry, "Edited teams"

  // Review Focus 3 / I6: Undo restores the old name and removes #33.
  await app.undo();
  await expect(half(page, 'Home').getByRole('button', { name: /^#4 Player One, 2 points, 0 fouls/ })).toBeVisible();
  await expect(half(page, 'Away').getByRole('button', { name: /^#33,/ })).toHaveCount(0);

  // Review Focus 3 / I10: the usage record still counts the save, and the undo (D8: team_edits, undos).
  await app.openEnd();
  const [header, row] = await downloadCsv(page, page.getByRole('button', exact('Usage CSV')));
  expect(Number(row[header.indexOf('team_edits')])).toBe(1);
  expect(Number(row[header.indexOf('undos')])).toBe(1);
});

test('Edit teams: Cancel leaves the game unchanged (D10)', async ({ page }) => {
  await startScoredGame(page);
  await openEditTeams(page);
  await page.getByLabel('Player 1 name', { exact: true }).fill('Player Uno');
  await page.getByRole('button', exact('Add their player')).click();
  await page.getByLabel('Their player 3 number', { exact: true }).fill('33');
  await page.getByRole('button', exact('Cancel')).click();

  await expect(half(page, 'Home').getByRole('button', { name: /^#4 Player One, 2 points, 0 fouls/ })).toBeVisible();
  await expect(half(page, 'Away').getByRole('button', { name: /^#33,/ })).toHaveCount(0);
  // Reopening shows the game's teams, not the cancelled draft.
  await openEditTeams(page);
  await expect(page.getByLabel('Player 1 name', { exact: true })).toHaveValue('Player One');
});

test('Edit teams: a duplicate number shows Setup\'s error and does not save (D11)', async ({ page }) => {
  await startScoredGame(page);
  await openEditTeams(page);
  await page.getByLabel('Their player 2 number', { exact: true }).fill('2');
  await page.getByRole('button', exact('Save')).click();
  await expect(page.getByRole('alert')).toContainText('Their roster: Duplicate number: #2.');
  await expect(page.getByRole('heading', exact('Edit teams'))).toBeVisible();
});
