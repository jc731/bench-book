import { expect, test } from '@playwright/test';
import { downloadCsv } from './csv';
import { OPPONENT, ROSTER, TEAM, ui } from './fixture';

/*
 * Task 4 / D7-D9, I10-I11. Expected counts come from the spec's counting rules (D8): `plays` counts
 * recorded plays, `fixes` = undos + edits + deletes + late adds (redos are not fixes), and `taps` is
 * any button click after Start game. Nothing here imports from src/.
 */
test('Usage CSV: counts follow D8, carries no names (I11), and does not mark an export (D9)', async ({ page }) => {
  const app = ui(page);
  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  await app.startGame();

  // An independent tally of button clicks after Start game (D8's `taps`), kept in the page.
  await page.evaluate(() => {
    (window as unknown as { __clicks: number }).__clicks = 0;
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) (window as unknown as { __clicks: number }).__clicks++;
    }, true);
  });
  await app.score('Player One', '+2'); // plays 1
  await app.foul('Player Four'); // plays 2
  await app.undo(); // undos 1, undoes the Foul
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); // redos 1
  await app.openLog();
  const log = app.logSection('Q1');
  await app.logRow(log, app.playText('Player One', '+2')).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); // deletes 1
  await app.back();
  await app.openEnd();

  await app.expectExportState(false, false);
  const rows = await downloadCsv(page, page.getByRole('button', { name: 'Usage CSV', exact: true }));
  const [header, row] = rows;
  const v = (k: string) => Number(row[header.indexOf(k)]);
  expect(v('plays')).toBe(2); // D8: +2 and Foul; I10: the Undo and the Delete leave it at 2
  expect(v('undos')).toBe(1);
  expect(v('redos')).toBe(1);
  expect(v('deletes')).toBe(1);
  expect(v('edits')).toBe(0);
  expect(v('late_adds')).toBe(0);
  expect(v('fixes')).toBe(2); // D8: undo + delete; the redo is not a fix
  const clicks = await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);
  expect(v('taps')).toBe(clicks); // D8: every button click after Start game, the Usage CSV click included

  // I11: no player, team or opponent name anywhere in the file.
  const text = rows.flat().join('|');
  for (const n of [TEAM, OPPONENT, ...ROSTER.map((p) => p.name)]) expect(text).not.toContain(n);

  // D9: the Usage download is not an export of the game.
  await app.expectExportState(false, false);
  await app.exportButton('Book CSV').click();
  await app.expectExportState(true, false);
  await page.getByRole('button', { name: 'Usage CSV', exact: true }).click();
  await app.expectExportState(true, false);
});
