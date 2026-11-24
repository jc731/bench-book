import { expect, test, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { colorContrast, OPPONENT, TEAM, ui, type Side } from './fixture';

/*
 * 1.1 one-tap rows: the spec's Invariants 1-7 (docs/superpowers/specs/2026-11-24-one-tap-rows-design.md)
 * plus the review focus points of the build plan. Timing tests run on Playwright's fake clock, frozen
 * after Start game so only `runFor` moves it. Nothing here imports from src/; invented names only.
 * Preact runs an effect after the next frame, which on the frozen clock is the first few ms of the
 * next `runFor`; so a settle wait "after a tap" ends a few ms past SETTLE_MS (2 s) of fake time.
 */
const exact = (name: string) => ({ name, exact: true });
const savedGame = (page: Page) => page.evaluate(() => localStorage.getItem('benchbook:game'));
const score = (page: Page, home: number, away: number) => expect(page.getByLabel(`Score Home ${home}, Away ${away}`)).toBeVisible();
/** A half's rows in display order, as their group labels read (`Home #4, on floor`). */
const order = (page: Page, side: Side) =>
  ui(page).half(side).getByRole('group').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')!.replace(/^(Home|Away) #(\S+),.*$/, '$2')));
const listOf = (page: Page, side: Side) => ui(page).half(side).getByTestId('row-list');

/** Setup with `home` players numbered 10.. and, when `away` is given, that many opponents numbered 30.. . */
async function setup(page: Page, home: number, away?: number) {
  await page.clock.install({ time: new Date('2026-11-24T18:00:00') });
  await page.goto('/');
  const app = ui(page);
  for (let i = 0; i < home; i++) {
    if (i > 0) await page.getByRole('button', exact('Add player')).click();
    await page.getByLabel(`Player ${i + 1} number`, { exact: true }).fill(String(10 + i));
    await page.getByLabel(`Player ${i + 1} name`, { exact: true }).fill(`Player ${i + 1}`);
  }
  if (away) await app.fillOppRoster(Array.from({ length: away }, (_, i) => ({ number: String(30 + i) })));
  await app.startGame();
  return app;
}
/** Stops fake time; from here only `page.clock.runFor` moves it. */
const freeze = (page: Page) => page.clock.pauseAt(new Date('2026-11-24T19:00:00'));

/** The scripted 7-player game (fixture ROSTER: #4 #00 #0 #12 #23 on the floor, #31 and #44 on the bench). */
async function startSeven(page: Page, away = false) {
  await page.clock.install({ time: new Date('2026-11-24T18:00:00') });
  await page.goto('/');
  const app = ui(page);
  await app.fillSetup(OPPONENT, TEAM);
  if (away) await app.fillOppRoster(['21', '22', '23', '24', '25'].map((number) => ({ number })));
  await app.startGame();
  return app;
}

async function playsCsv(page: Page) {
  const app = ui(page);
  await app.openEnd();
  const [header, ...plays] = await downloadCsv(page, app.exportButton('Plays CSV'));
  return { header, plays };
}

test('row +2 and popup +2 save the same event; so do Foul and Foul (inv. 1)', async ({ page }) => {
  const app = await startSeven(page);
  // Inv. 1: type, side, player and period match between a play by row and the same play by popup.
  await app.quick2('Home', '4').click();
  await app.score('Player One', '+2');
  await app.quickFoul('Home', '4').click();
  await app.foul('Player One');
  const { header, plays } = await playsCsv(page);
  const c = (name: string) => header.indexOf(name);
  const key = (r: string[]) => ['event', 'side', 'team', 'number', 'player', 'period'].map((k) => r[c(k)]).join('|');
  expect(plays).toHaveLength(4);
  expect(key(plays[0])).toBe(key(plays[1])); // +2: row, then popup
  expect(key(plays[2])).toBe(key(plays[3])); // Foul: row, then popup
  expect(plays[0][c('event')]).toBe('FG2');
  expect(plays[2][c('event')]).toBe('FOUL');
  expect(plays[0][c('number')]).toBe('4'); // not an empty cell on both sides
});

test('one row tap is one play and one tap (inv. 2)', async ({ page }) => {
  const app = await startSeven(page);
  await page.evaluate(() => {
    (window as unknown as { __clicks: number }).__clicks = 0;
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) (window as unknown as { __clicks: number }).__clicks++;
    }, true);
  });
  await app.quick2('Home', '4').click(); // the one tap under test
  await app.openEnd(); // More, Final / export: 2 taps
  const rows = await downloadCsv(page, page.getByRole('button', exact('Usage CSV'))); // the click on it: 1 tap
  const [header, row] = rows;
  const v = (k: string) => Number(row[header.indexOf(k)]);
  expect(v('plays')).toBe(1); // inv. 2: once in `plays`
  expect(v('taps')).toBe(1 + 2 + 1); // inv. 2 and the D8 counting rule: the row tap, two to open the export, the Usage click
  expect(await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks)).toBe(v('taps')); // independent tally
});

test('a double tap records once; another player in the window records (inv. 3)', async ({ page }) => {
  const app = await startSeven(page);
  await freeze(page);
  await app.quick2('Home', '4').dblclick(); // same side + player + play within 400 ms
  await score(page, 2, 0);
  await page.clock.runFor(1000); // clear the window
  await app.quick2('Home', '4').click();
  await score(page, 4, 0);
  await page.clock.runFor(100); // inside the window, but a different player
  await app.quick2('Home', '00').click();
  await score(page, 6, 0);
  await page.clock.runFor(100); // a different play by the same player also records
  await app.quickFoul('Home', '00').click();
  await expect(app.card('Player Two')).toHaveAccessibleName('#00, 2 points, 1 foul, more plays');
});

test('an out row opens the popup and records nothing (inv. 4)', async ({ page }) => {
  const app = await startSeven(page);
  await freeze(page);
  for (let i = 0; i < 5; i++) {
    await app.quickFoul('Home', '4').click();
    await page.clock.runFor(500); // past the double-tap window, so each tap records
  }
  await expect(app.card('Player One')).toHaveAccessibleName('#4, 0 points, 5 fouls, out, more plays');
  const before = await savedGame(page);
  await app.quick2('Home', '4').click();
  await expect(page.getByRole('dialog').getByTestId('out-warning')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', exact('Done')).click();
  await app.quickFoul('Home', '4').click(); // the out row's Foul opens it too
  await expect(page.getByRole('dialog').getByTestId('out-warning')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', exact('Done')).click();
  await score(page, 0, 0);
  expect(await savedGame(page)).toBe(before); // nothing recorded
});

test('the swap moves the player up after 2 s, scrolls to top, and leaves the saved game alone (inv. 5)', async ({ page }) => {
  const app = await setup(page, 12);
  await freeze(page);
  const list = listOf(page, 'Home');
  // Programmatic, not a wheel: a hand scroll holds the list for 5 s (Review Focus 4, its own test).
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const before = await order(page, 'Home');
  expect(before.slice(0, 5)).toEqual(['10', '11', '12', '13', '14']);
  await app.quick2('Home', '21').click(); // the last bench player, below the fold
  const saved = await savedGame(page);
  await page.clock.runFor(1900);
  expect(await order(page, 'Home')).toEqual(before); // not yet
  await page.clock.runFor(200);
  await expect(app.half('Home').getByTestId('swap-status')).toHaveText('#21 moved up');
  expect((await order(page, 'Home')).slice(0, 5)).toContain('21');
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  expect(await savedGame(page)).toBe(saved); // inv. 5: display order never changes the saved game
});

for (const n of [10, 15]) {
  test(`${n} players a side: controls in view, nothing scrolls sideways (inv. 6)`, async ({ page }) => {
    const app = await setup(page, n, n);
    await app.expectControlsInView();
    expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([390, 664]); // the spec's viewport
  });
}

test('no opponent roster: Away has no rows and its controls are in view (inv. 6)', async ({ page }) => {
  const app = await startSeven(page);
  await expect(app.half('Away').getByRole('group')).toHaveCount(0);
  await app.expectControlsInView();
});

test('the swap guard holds that half\'s row buttons for 500 ms only (inv. 7)', async ({ page }) => {
  const app = await startSeven(page, true);
  await freeze(page);
  await app.quick2('Home', '44').click(); // a bench player: after the wait the Home order swaps
  await page.clock.runFor(2100);
  await expect(app.half('Home').getByTestId('swap-status')).toHaveText('#44 moved up');
  await score(page, 2, 0);
  // The swap showed between 0 and 100 ms ago.
  await app.quick2('Home', '00').click();
  await score(page, 2, 0); // Home half guarded: nothing recorded
  await app.quick2('Away', '21').click();
  await score(page, 2, 2); // Away half unaffected
  await app.card('Player Two').click(); // the number area always works
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', exact('Done')).click();
  await page.clock.runFor(500); // 500 ms+ after the swap
  await app.quick2('Home', '00').click();
  await score(page, 4, 2);
});

test('row +2 then Undo leaves the game as before (Review Focus 1)', async ({ page }) => {
  const app = await startSeven(page);
  await freeze(page);
  await app.quick2('Home', '4').click();
  const afterRow = await page.getByTestId('feedback-text').textContent();
  await score(page, 2, 0);
  await app.undo();
  const undoneRow = await page.getByTestId('feedback-text').textContent();
  await score(page, 0, 0);
  await page.clock.runFor(1000);
  await app.score('Player One', '+2'); // the same play by popup
  const afterPopup = await page.getByTestId('feedback-text').textContent();
  await app.undo();
  const undonePopup = await page.getByTestId('feedback-text').textContent();
  await score(page, 0, 0);
  expect(afterRow).toBe(afterPopup);
  expect(undoneRow).toBe(undonePopup);
  expect(afterRow).toMatch(/#4/); // the toast names the player, so the comparison is not of two blanks
});

test('hand scroll holds the list for 5 s (Review Focus 4)', async ({ page }) => {
  const app = await setup(page, 12);
  await freeze(page);
  const list = listOf(page, 'Home');
  const box = (await list.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await app.quick2('Home', '21').click();
  const held = await list.evaluate((el) => el.scrollTop);
  await page.clock.runFor(2100); // inside HAND_SCROLL_HOLD_MS (5 s) of the wheel
  await expect(app.half('Home').getByTestId('swap-status')).toHaveText('#21 moved up');
  expect(await list.evaluate((el) => el.scrollTop)).toBe(held); // the swap neither scrolled it back nor dropped it to the top
});

test('the first live screen shows the row tip once per device', async ({ page }) => {
  await startSeven(page);
  const line = page.getByTestId('feedback-text');
  await expect(line).toHaveText('Tap a number for 3s, free throws and fixes.');
  await page.getByRole('navigation').getByRole('button', exact('More')).click();
  await page.getByRole('button', exact('New game')).click();
  await page.getByRole('button', exact('Discard and start new')).click();
  await page.getByRole('button', exact('Start game')).click();
  await expect(page.getByLabel('Score Home 0, Away 0')).toBeVisible();
  await expect(line).not.toHaveText('Tap a number for 3s, free throws and fixes.');
});

/** Five row Fouls on a player, past the double-tap window each time. */
async function foulOut(page: Page, side: Side, number: string) {
  for (let i = 0; i < 5; i++) {
    await ui(page).quickFoul(side, number).click();
    await page.clock.runFor(500);
  }
}

test('a foul-out leaves the row order unchanged until the settle wait', async ({ page }) => {
  const app = await setup(page, 12);
  await freeze(page);
  const before = await order(page, 'Home');
  await foulOut(page, 'Home', '12'); // a top-block player, by row Foul
  await expect(app.half('Home').getByRole('button', { name: /^#12, .*, out, more plays$/ })).toBeVisible();
  expect(await order(page, 'Home')).toEqual(before); // spec "settle wait": a foul-out moves no row
  await page.clock.runFor(2100);
  expect(await order(page, 'Home')).toEqual(before); // and the settled order is the same: the out player holds its place
});

test("an out row's ring stays readable while a swap flashes it", async ({ page }) => {
  const app = await setup(page, 12, 12);
  await freeze(page);
  // An out player in the top block is the one a bench player's play displaces, so it is flashed by the swap.
  await foulOut(page, 'Home', '12');
  await foulOut(page, 'Away', '32');
  await app.quick2('Home', '21').click();
  await app.quick2('Away', '41').click();
  await page.clock.runFor(2100); // both halves settle
  for (const [side, out, up] of [['Home', '12', '21'], ['Away', '32', '41']] as const) {
    await expect(app.half(side).getByTestId('swap-status')).toHaveText(`#${up} moved up`);
    const row = app.row(side, out);
    await expect(row).toHaveAttribute('data-flash', '1'); // the swap flashes the displaced out row
    expect(await colorContrast(row, 'ringColor')).toBeGreaterThanOrEqual(3); // WCAG non-text 3:1 during the flash
  }
});
