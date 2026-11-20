import { expect, test, type Page } from '@playwright/test';
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
