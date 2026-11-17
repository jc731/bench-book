import { expect, test } from '@playwright/test';
import { OPPONENT, TEAM, ui } from '../../e2e/fixture';

/*
 * `pnpm howto:shots`, run by `pnpm release`: the four How-to screenshots, from the full-game
 * fixture's invented roster. It writes only these four files, so an image the owner made by
 * hand (under a new filename, referenced from src/ui/howto-content.ts) is never overwritten.
 */

const OUT = 'public/howto';
/** Workbox leaves any file over 2 MiB out of the precache, silently; stay well under it. */
const MAX_BYTES = 1024 * 1024;

test('How-to screenshots', async ({ page }) => {
  const app = ui(page);
  const dialog = () => page.getByRole('dialog');
  const shot = async (name: string) => {
    const buf = await page.screenshot({ path: `${OUT}/${name}.png` });
    expect(buf.length, `${name}.png is ${buf.length} bytes`).toBeLessThan(MAX_BYTES);
  };

  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  await app.fillOppRoster([
    { number: '7', name: 'Rival One' },
    { number: '22', name: 'Rival Two' },
    { number: '30', name: 'Rival Three' },
  ]);
  await app.startGame();
  // Their cards, by number: tap, then the play.
  const their = async (no: string, plays: string[]) => {
    await app.half('Away').getByRole('button', { name: new RegExp(`^#${no} `) }).click();
    for (const p of plays) await dialog().getByRole('button', { name: p, exact: true }).click();
    await expect(dialog()).toHaveCount(0);
  };

  // Reading the screen: a player at 4 fouls (amber), a 5th team foul (bonus), a timeout used,
  // points and a couple of fouls for both teams, their players by number.
  await app.score('Player One', '+2');
  await their('7', ['+2']);
  await app.score('Player Three', '+3');
  for (let i = 0; i < 4; i++) await app.foul('Player Four');
  await app.foul('Player One');
  await app.ft('Player Two', true, false);
  await app.timeout('Full');
  await their('22', ['+3']);
  await their('22', ['Foul']);
  await their('30', ['Foul']);
  await app.score('Player Five', '+2');
  await app.expectWarning('Player Four');
  await expect(page.getByRole('banner').getByText('Away shoots', { exact: true })).toBeVisible();
  await shot('reading-the-screen');

  // Mistakes: Log, with one row's fix sheet open.
  await app.openLog();
  await app.logRow(app.logSection('Q1'), app.playText('Player Five', '+2')).click();
  await expect(dialog()).toBeVisible();
  await shot('mistakes');
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog()).toHaveCount(0);
  await app.back();

  // End of quarter: End Q1, then the check with the book's numbers typed in.
  await app.endPeriod('Q1');
  await app.checkQuarter('Q1', 8, 5);
  await app.expectMatches();
  await shot('end-of-quarter');
  await app.saveCheck();

  // Subs: #44 scores from the bench, so six are on, and the Sub button asks who went out.
  await app.score('Player Seven', '+2');
  await app.subButton('Home').click();
  await expect(dialog()).toHaveAccessibleName('Who went out?');
  await expect(dialog().getByText('likely', { exact: true })).toBeVisible();
  await expect(dialog().getByText('just in', { exact: true })).toBeVisible();
  await shot('subs');
});
