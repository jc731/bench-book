import { expect, test, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { OPPONENT, TEAM, ui } from './fixture';

/*
 * Both-teams release test: one home game with both rosters, played by number, with every
 * expected number worked out BY HAND from the table below. Nothing here imports from src/.
 *
 * Ours (fixture roster): #4 One, #00 Two, #0 Three, #12 Four, #23 Five, #31 Six, #44 Seven.
 * Theirs (set up): #4 Rival One (the SAME number as our #4), #24 Rival Two, #10 Rival Three,
 * #15 Rival Four, #5 Rival Five, #21 Rival Six. Their #33 is not on the roster: added mid-game at
 * Whose number?. Rival Five and Rival Six make no play: they give their team a bench (six players),
 * so #24's foul-out has a sub to fill it.
 *
 * The lineup (S rows) changes no score, foul, timeout or play count: the numbers are as before 0.9.
 * Each team's first five start: ours #4 #00 #0 #12 #23 (bench #31 #44), theirs #4 #24 #10 #15 #5
 * (bench #21).
 *
 *  ev | per | event                                    |  Us | Them | notes
 *  ---+-----+------------------------------------------+-----+------+---------------------------
 *   1 | Q1  | us   #4  One      +2                     |   2 |    0 |
 *   2 | Q1  | them #4           +3                     |   2 |    3 | same number, other card
 *   3 | Q1  | us   #44 Seven    +2                     |   4 |    3 | bench -> floor: Sub (forgotten sub)
 *   4 | Q1  | them #24          Foul                   |   4 |    3 | their TF 1
 *   5 | Q1  | them #24          Foul                   |   4 |    3 | their TF 2
 *   6 | Q1  | them #10          +2                     |   4 |    5 |
 *   7 | Q1  | us   #12 Four     Foul                   |   4 |    5 | our TF 1
 *   8 | Q1  | us   #0  Three    +3                     |   7 |    5 |
 *   9 | Q1  | them Full timeout                        |   7 |    5 | their Full 1 of 3
 *  S1 | Q1  | us   Sub: tap the hinted #00      |     |      | "#44 (Home) in for #00"
 *     |     | End Q1. Check Q1: book 7 / 5             |     |      | MATCHED
 *  S2 | Q2  | us   #00 checks in for #44 (3 taps)     |     |      | deliberate sub
 *  10 | Q2  | them #24          Foul                   |   7 |    5 | #24 has 3
 *  11 | Q2  | us   #00 Two      FT made                |   8 |    5 |
 *  12 | Q2  | us   #00 Two      FT missed              |   8 |    5 | really MADE (fix a: -> 9)
 *  13 | Q2  | them #24          Foul                   |   8 |    5 | #24 has 4
 *  14 | Q2  | them Full timeout                        |   8 |    5 | their Full 2 of 3
 *  15 | Q2  | us   #12 Four     Foul                   |   8 |    5 | our Q2 TF 1
 *  16 | Q2  | them #15          +2                     |   8 |    7 |
 *  17 | Q2  | them #24          Foul                   |   8 |    7 | #24 has 5 -> OUT; their Q2 TF 3
 *  S3 | Q2  | them Sub: Who came in? #21      |     |      | "Away floor updated"
 *  18 | Q2  | them Full timeout                        |   8 |    7 | their Full 3 of 3 (0 left)
 *  19 | Q2  | them Full timeout, Take one anyway       |   8 |    7 | their Full 4 of 3
 *  20 | Q2  | us   #23 Five     Foul                   |   8 |    7 | our Q2 TF 2 (book says 3)
 *  S4 | Q2  | us   #31 checks in for #23 (3 taps)     |     |      | deliberate sub
 *  21 | Q2  | us   #31 Six      +3                     |  11 |    7 |
 *  22 | Q2  | them #4           FT made                |  11 |    8 |
 *  23 | Q2  | them #10          +3                     |  11 |   11 | Q2: us 1+3 = 4, them 2+1+3 = 6
 *     |     | End Q2. Check Q2: book 12 / 11           |     |      | us 1 short (FT), fouls 1 short
 *  24 | Q2  | ADD us #31 Six Foul from the check       |  11 |   11 | score unchanged; our Q2 TF 3
 *     |     | fix a: ev 12 FT missed -> FT made        |  12 |   11 | MATCHED -> Fixed
 *  S5 | Q3  | us   halftime line change: #12, #31 off; #23, #44 on (Who's on the floor?)
 *  25 | Q3  | them +Play +3, Whose number? 33 (new)    |  12 |   14 | #33 joins their roster; Sub, left
 *  26 | Q3  | us   #4  One      +2                     |  14 |   14 |
 *  27 | Q3  | us   #44 Seven    +3                     |  17 |   14 | End Q3. Check Q3: 17 / 14 MATCHED
 *  28 | Q4  | them #33          +2                     |  17 |   16 |
 *  29 | Q4  | them +Play FT made, 33, then FT made     |  17 |   18 | #33 sheet for the pair
 *  30 | Q4  | us   #0  Three    +2                     |  19 |   18 |
 *  31 | Q4  | us   #00 Two      +3                     |  22 |   18 | End Q4 -> End game; Q4 unchecked
 *
 * Events: Q1 9 + Q2 14 + 1 added + Q3 3 + Q4 5 = 32 (ours 14, theirs 18).
 * Final: Test Home 22, Test Opp 18.
 * Their #24: 5 fouls (2 in Q1, 3 in Q2). Their #33: 3 + 2 + 1 + 1 = 7 points, no fouls.
 * Their team fouls: Q1 2, Q2 3. Ours: Q1 1, Q2 3 (2 logged + 1 added). Timeouts used: theirs Full 4 of 3.
 * Floor at the end: ours #4 #0 #00 #23 #44 (5); theirs #4 #10 #15 #5 #21 #33 (6: nobody told the app
 * who #33 replaced, and nothing asks).
 */

const theirs = (page: Page) => ui(page).half('Away');
const exact = (name: string) => ({ name, exact: true });
/** Their player's card by number: `#24 Rival Two, 0 points, ...` or, for a nameless one, `#33, ...`. */
const theirCard = (page: Page, no: string) => theirs(page).getByRole('button', { name: new RegExp(`^#${no}[ ,]`) });

/** Taps their card, then each play; an FT pair closes with Done. */
async function their(page: Page, no: string, plays: string[], done = false) {
  const dialog = page.getByRole('dialog');
  await theirCard(page, no).click();
  for (const p of plays) await dialog.getByRole('button', exact(p)).click();
  if (done) await dialog.getByRole('button', exact('Done')).click();
  await expect(dialog).toHaveCount(0);
}

/** Their + Play, the play, then a number typed at Whose number?. Returns with the sheet that follows still open for an FT. */
async function theirPlusPlay(page: Page, play: string, number: string) {
  const dialog = page.getByRole('dialog');
  await theirs(page).getByRole('button', exact('+ Play')).click();
  await dialog.getByRole('button', exact(play)).click();
  await expect(dialog).toHaveAccessibleName('Whose number?');
  await dialog.getByLabel('Number', { exact: true }).fill(number);
  await dialog.getByRole('button', exact('Save')).click();
}

test('both teams: a game by number with a halftime fix, a foul-out, a timeout at zero, an added player and subs', async ({ page }) => {
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  const FULL_TIMEOUTS = { full: 3, thirty: 2 };
  const strip = (us: number, opp: number, period: string, fouls: number) =>
    app.expectStrip({ us, opp, period, fouls, bonus: false, timeouts: FULL_TIMEOUTS });

  await test.step('setup: both rosters, #4 on both teams', async () => {
    await page.goto('/');
    await app.fillSetup(OPPONENT, TEAM);
    await app.fillOppRoster([
      { number: '4', name: 'Rival One' },
      { number: '24', name: 'Rival Two' },
      { number: '10', name: 'Rival Three' },
      { number: '15', name: 'Rival Four' },
      { number: '5', name: 'Rival Five' },
      { number: '21', name: 'Rival Six' },
    ]);
    await app.startGame();
    await strip(0, 0, 'Q1', 0);
    // Each team's first five start; the rest are the bench. Before a team's first play its Sub button reads Starters.
    expect(await app.floorOf('Home')).toEqual(['4', '00', '0', '12', '23']);
    expect(await app.floorOf('Away')).toEqual(['4', '24', '10', '15', '5']);
    await expect(app.subButton('Home')).toHaveText('Starters');
    await expect(app.subButton('Away')).toHaveText('Starters');
  });

  await test.step('Q1: plays for both teams by number; the shared #4 is two different cards', async () => {
    await app.score('Player One', '+2');
    await their(page, '4', ['+3']);
    await app.expectToast('#4 (Away) +3');
    await expect(app.card('Player One')).toHaveAccessibleName('#4 Player One, 2 points, 0 fouls');
    await expect(theirCard(page, '4')).toHaveAccessibleName('#4 Rival One, 3 points, 0 fouls');
    // A forgotten sub: #44 scores from the bench. They go on silently (D4); the Sub button stays a gray Sub (D3).
    await app.score('Player Seven', '+2');
    await app.expectToast('#44 (Home) +2');
    await expect(app.subButton('Home')).toHaveText('Sub');
    await expect(app.subButton('Home')).not.toHaveClass(/amber/);
    await their(page, '24', ['Foul']);
    await their(page, '24', ['Foul']);
    await their(page, '10', ['+2']);
    await app.foul('Player Four');
    await app.score('Player Three', '+3');
    await app.timeout('Full', 'Away');
    await app.expectToast('Away timeout (Full)');
    await expect(theirs(page).getByRole('button', exact('Full: 2'))).toBeVisible();
    // During the timeout, the forgotten sub: the button is still a gray Sub. #00 has made no play, so they are
    // the one longest without a play; one tap closes the sheet at five.
    await expect(app.subButton('Home')).toHaveText('Sub');
    await expect(app.subButton('Home')).not.toHaveClass(/amber/);
    await app.subButton('Home').click();
    await expect(dialog).toHaveAccessibleName('Who went out?');
    await expect(dialog.getByRole('button', { name: /^#44 / })).toHaveAccessibleName('#44 Player Seven, just in');
    await expect(dialog.getByRole('button', { name: /^#00 / })).toHaveAccessibleName('#00 Player Two, longest without a play');
    await dialog.getByRole('button', { name: /^#00 / }).click();
    await expect(dialog).toHaveCount(0);
    await app.expectToastUndo('#44 (Home) in for #00');
    expect(await app.floorOf('Home')).toEqual(['4', '0', '12', '23', '44']);
    await expect(app.subButton('Home')).toHaveText('Sub');
    await strip(7, 5, 'Q1', 1);
    await expect(theirs(page).getByText('Team fouls 2', { exact: true })).toBeVisible();
    await expect(theirCard(page, '24')).toHaveAccessibleName('#24 Rival Two, 0 points, 2 fouls');

    await app.endPeriod('Q1');
    await app.checkQuarter('Q1', 7, 5);
    await app.expectMatches();
    await app.saveCheck();
    await expect(app.banner('Q1')).toHaveCount(0);
  });

  await test.step('Q2: their #24 fouls out, 3 Full timeouts, a 4th taken anyway at zero', async () => {
    // A deliberate sub at the quarter break, 3 taps: #00 checks in for #44.
    await app.subIn('Home', 'Player Two', 'Player Seven');
    await app.expectToastUndo('#00 (Home) in for #44');
    expect(await app.floorOf('Home')).toEqual(['4', '0', '12', '23', '00']);
    await their(page, '24', ['Foul']);
    await app.ft('Player Two', true, false); // the second is logged as missed, though it went in
    await their(page, '24', ['Foul']);
    await app.timeout('Full', 'Away');
    await app.foul('Player Four');
    await their(page, '15', ['+2']);
    await their(page, '24', ['Foul']);
    await app.expectToast('#24 Rival Two (Away) out, 5 fouls. Tell the official.');
    await expect(theirCard(page, '24')).toHaveAccessibleName('#24 Rival Two, 0 points, 5 fouls, out');
    await expect(app.subButton('Away')).toHaveText('Sub');
    // The out warning shows on their sheet and every play is grayed out.
    await theirCard(page, '24').click();
    await expect(dialog.getByTestId('out-warning')).toContainText('Out: 5 fouls.');
    for (const play of ['+2', '+3', 'FT made', 'FT missed', 'Foul', 'Tech foul']) {
      await expect(dialog.getByRole('button', exact(play))).toBeDisabled();
    }
    await dialog.getByRole('button', exact('Done')).click();
    await expect(dialog).toHaveCount(0);
    // The foul-out's sub: #21 checks in. Who came in? lists the bench, #24 grayed with their reason.
    await app.subButton('Away').click();
    await expect(dialog).toHaveAccessibleName('Who came in?');
    await expect(dialog.getByRole('button', { name: /^#24 / })).toBeDisabled();
    await dialog.getByRole('button', { name: /^#21 / }).click();
    await expect(dialog).toHaveCount(0);
    await app.expectToastUndo('Away floor updated');
    expect(await app.floorOf('Away')).toEqual(['4', '10', '15', '5', '21']);
    await expect(app.subButton('Away')).toHaveText('Sub');

    await app.timeout('Full', 'Away'); // the third and last
    const zero = theirs(page).getByRole('button', exact('Full: 0'));
    await expect(zero).toBeVisible();
    await zero.click();
    await expect(dialog).toContainText('Away has no full timeouts left. Are you sure?');
    await dialog.getByRole('button', exact('Take one anyway')).click();
    await expect(dialog).toHaveCount(0);
    await app.expectToast('Away timeout (Full)');
    await expect(zero).toBeVisible(); // never below 0
    await app.foul('Player Five');
    // Another deliberate sub: #31 checks in for #23, so their three is no promotion.
    await app.subIn('Home', 'Player Six', 'Player Five');
    await app.expectToastUndo('#31 (Home) in for #23');
    await app.score('Player Six', '+3');
    await app.expectToast('#31 (Home) +3');
    await their(page, '4', ['FT made'], true);
    await their(page, '10', ['+3']);
    await strip(11, 11, 'Q2', 2);
    await expect(theirs(page).getByText('Team fouls 3', { exact: true })).toBeVisible();
    await app.endPeriod('Q2');
  });

  await test.step('halftime check: the book is at 12 / 11; one FT and one foul to fix', async () => {
    await app.checkQuarter('Q2', 12, 11);
    await app.expectAppHas('Q2', 4, 6, 11, 11);
    await app.expectShort('Q2', 12, 11, 1);
    await app.expectMismatchHint();
    // Their score matches the book, so nothing warns there.
    await expect(page.getByTestId('compare-opp')).not.toHaveAttribute('class', /amber/);
    const homeFouls = page.getByText(/^Team fouls in Q2 \(Home\):/);
    const awayFouls = page.getByText(/^Team fouls in Q2 \(Away\):/);
    await expect(homeFouls).toHaveText('Team fouls in Q2 (Home): 2');
    await expect(awayFouls).toHaveText('Team fouls in Q2 (Away): 3');

    // A free throw logged as missed that went in: change its type in the fix sheet.
    const row = app.logRow(app.fixRegion(), '#00 Player Two (Home) · FT missed');
    await expect(row).toHaveCount(1);
    await row.click();
    await dialog.getByRole('group', exact('Play')).getByRole('button', exact('FT made')).click();
    await dialog.getByRole('button', exact('Save')).click();
    await expect(dialog).toHaveCount(0);
    await app.expectAppHas('Q2', 5, 6, 12, 11);
    await app.expectMatches();
    await expect(homeFouls).toHaveText('Team fouls in Q2 (Home): 2');

    // A foul never logged: the book has 3. Still offered once the score matches; it moves the fouls, not the score.
    await app.fixRegion().getByRole('button', exact('Add play to Q2')).click();
    await dialog.getByRole('button', exact('#31 Player Six')).click();
    await dialog.getByRole('button', exact('Foul')).click();
    await expect(dialog).toHaveCount(0);
    await expect(homeFouls).toHaveText('Team fouls in Q2 (Home): 3');
    await expect(awayFouls).toHaveText('Team fouls in Q2 (Away): 3');
    await app.expectAppHas('Q2', 5, 6, 12, 11);
    await app.expectMatches();
    await expect(page.getByRole('list', { name: 'Home player fouls, whole game' }).getByRole('listitem').filter({ hasText: '#31 Player Six' })).toHaveText('#31 Player Six1');
    await app.saveCheck();
    await expect(app.banner('Q2')).toHaveCount(0);
    // The foul added from the check was #31's while they were on: the floor is as the last sub left it.
    expect(await app.floorOf('Home')).toEqual(['4', '0', '12', '00', '31']);
  });

  await test.step('halftime: a line change on "Who\'s on the floor?"; it changes no count', async () => {
    await expect(app.subButton('Home')).toHaveText('Sub');
    await app.subButton('Home').click();
    await expect(dialog).toHaveAccessibleName("Who's on the floor?");
    for (const n of ['12', '31', '23', '44']) await dialog.getByRole('button', { name: new RegExp(`^#${n} `) }).click();
    await expect(dialog.getByTestId('sub-count')).toHaveText('5 on the floor');
    await dialog.getByRole('button', exact('Done')).click();
    await expect(dialog).toHaveCount(0);
    await app.expectToastUndo('Home floor updated');
    expect(await app.floorOf('Home')).toEqual(['4', '0', '00', '23', '44']);
    await strip(12, 11, 'Q3', 0);
  });

  await test.step('Q3: their late #33 joins at Whose number? and scores; check matches', async () => {
    await expect(theirCard(page, '33')).toHaveCount(0);
    await theirPlusPlay(page, '+3', '33');
    await expect(dialog).toHaveCount(0);
    // Their seventh player: they join on the bench, and their play puts them on.
    await app.expectToast('#33 (Away) +3');
    await expect(theirCard(page, '33')).toHaveCount(1);
    await expect(theirCard(page, '33')).toHaveAccessibleName('#33, 3 points, 0 fouls');
    // Nobody tells the app who they replaced, and nothing asks: the Sub button just reads Sub.
    await expect(app.subButton('Away')).toHaveText('Sub');
    await app.score('Player One', '+2');
    await app.score('Player Seven', '+3');
    await strip(17, 14, 'Q3', 0);
    await app.endPeriod('Q3');
    await app.checkQuarter('Q3', 17, 14);
    await app.expectMatches();
    await app.saveCheck();
  });

  await test.step('Q4: #33 again by card and by number; End game with Q4 unchecked', async () => {
    await their(page, '33', ['+2']);
    // A known number is the same player: no second #33 card.
    await theirPlusPlay(page, 'FT made', '33');
    await expect(dialog).toHaveAccessibleName('#33 (Away)');
    await dialog.getByRole('button', exact('FT made')).click();
    await dialog.getByRole('button', exact('Done')).click();
    await expect(theirCard(page, '33')).toHaveCount(1);
    await expect(theirCard(page, '33')).toHaveAccessibleName('#33, 7 points, 0 fouls');
    await app.score('Player Three', '+2');
    await app.score('Player Two', '+3');
    await strip(22, 18, 'Q4', 0);
    // Every Q3 and Q4 scorer of ours was in the halftime five: no promotion. Theirs is still 6 on.
    expect(await app.floorOf('Home')).toEqual(['4', '0', '00', '23', '44']);
    expect(await app.floorOf('Away')).toEqual(['4', '10', '15', '5', '21', '33']);
    await expect(app.subButton('Home')).toHaveText('Sub');
    await app.endPeriodThen('Q4', 'End game (no overtime)');
    await app.expectFinalScore(22, 18);
    await expect(app.issue('Q4', 'pending')).toBeVisible();
    await expect(app.issues()).not.toContainText('Q2');
    await expect(app.issues()).not.toContainText('Q3');
  });

  await test.step('Book CSV: our block, their block with #24 out and 4 of 3 timeouts', async () => {
    const rows = await downloadCsv(page, app.exportButton('Book CSV'));
    const at = (first: string) => rows.findIndex((r) => r[0] === first);

    const score = at('Score by period (running score after each)');
    expect(rows[score + 1]).toEqual(['', 'Q1', 'Q2', 'Q3', 'Q4', 'Final']);
    expect(rows[score + 2]).toEqual([TEAM, '7', '12', '17', '22*', '22*']);
    expect(rows[score + 3]).toEqual([OPPONENT, '5', '11', '14', '18*', '18*']);

    // Our block runs to the first block heading; theirs follows it.
    const heading = rows.findIndex((r) => /\((Home|Away)\)$/.test(r[0]));
    expect(heading).toBeGreaterThan(0);
    const mine = rows.slice(0, heading);
    const theirBlock = rows.slice(heading);
    expect(theirBlock[0][0]).toBe(`${OPPONENT} (Away)`);

    const colOf = (block: string[][], name: string) => block[block.findIndex((r) => r[0] === 'POS')].indexOf(name);
    const line = (block: string[][], name: string) => block.find((r) => r[1] === name)!;
    const fouls = (block: string[][], name: string) => line(block, name)[colOf(block, 'FOULS')];
    const tp = (block: string[][], name: string) => line(block, name)[colOf(block, 'TP')];

    // Ours: Player Six's added foul, Player Two's fixed FT.
    expect(fouls(mine, 'Player Six')).toBe('1');
    expect(fouls(mine, 'Player Four')).toBe('2');
    expect(tp(mine, 'Player Two')).toBe('5');
    expect(line(mine, 'Player Two')[colOf(mine, 'FTM')]).toBe('2');
    expect(mine.find((r) => r[0] === 'TEAM TOTALS')![colOf(mine, 'TP')]).toBe('22');
    expect(mine.filter((r) => r[0] === 'Team fouls')).toEqual([
      ['Team fouls', 'Q1', '1'], ['Team fouls', 'Q2', '3'], ['Team fouls', 'Q3', '0'], ['Team fouls', 'Q4', '0'],
    ]);
    expect(mine.filter((r) => r[0] === 'Timeouts used')).toEqual([
      ['Timeouts used', 'Full', '0 of 3'], ['Timeouts used', '30', '0 of 2'], ['Timeouts used', 'OT', '0 of 0'],
    ]);

    // Theirs.
    expect(fouls(theirBlock, 'Rival Two')).toBe('5');
    expect(line(theirBlock, 'Rival Two')[2]).toBe('#24');
    expect(tp(theirBlock, 'Rival One')).toBe('4');
    expect(line(theirBlock, 'Rival One')[2]).toBe('#4');
    expect(tp(theirBlock, 'Rival Three')).toBe('5');
    expect(tp(theirBlock, 'Rival Four')).toBe('2');
    // The two who only ever sat on the bench or subbed in: a line each, all zeros.
    for (const name of ['Rival Five', 'Rival Six']) {
      expect([tp(theirBlock, name), fouls(theirBlock, name)], name).toEqual(['0', '0']);
    }
    // The added #33 is a row with no name and 7 points: 3 + 2 + 1 + 1.
    const added = theirBlock.find((r) => r[2] === '#33')!;
    expect(added[1]).toBe('');
    expect(added[colOf(theirBlock, 'TP')]).toBe('7');
    expect(added[colOf(theirBlock, 'FTM')]).toBe('2');
    expect(added[colOf(theirBlock, 'FOULS')]).toBe('0');
    expect(theirBlock.find((r) => r[0] === 'TEAM TOTALS')![colOf(theirBlock, 'TP')]).toBe('18');
    expect(theirBlock.filter((r) => r[0] === 'Team fouls')).toEqual([
      ['Team fouls', 'Q1', '2'], ['Team fouls', 'Q2', '3'], ['Team fouls', 'Q3', '0'], ['Team fouls', 'Q4', '0'],
    ]);
    expect(theirBlock.filter((r) => r[0] === 'Timeouts used')).toEqual([
      ['Timeouts used', 'Full', '4 of 3'], ['Timeouts used', '30', '0 of 2'], ['Timeouts used', 'OT', '0 of 0'],
    ]);
  });

  await test.step('Plays CSV: every row on its own side, their #33 rows, the fixed FT', async () => {
    const [header, ...plays] = await downloadCsv(page, app.exportButton('Plays CSV'));
    const c = (name: string) => header.indexOf(name);
    // The 32 plays and nothing else: the five subs are not plays.
    expect(plays).toHaveLength(32);
    expect(['Q1', 'Q2', 'Q3', 'Q4'].map((p) => plays.filter((r) => r[c('period')] === p).length)).toEqual([9, 15, 3, 5]);

    // team and side agree on every row: us is Home, they are Away.
    for (const r of plays) expect(r[c('side')]).toBe(r[c('team')] === 'us' ? 'home' : 'away');
    expect(plays.filter((r) => r[c('team')] === 'us')).toHaveLength(14);
    expect(plays.filter((r) => r[c('side')] === 'away')).toHaveLength(18);
    // Their points are their own plays now, never the old OPP_PTS.
    expect(plays.filter((r) => r[c('event')] === 'OPP_PTS')).toHaveLength(0);

    const rowsOf = (team: string, no: string) => plays.filter((r) => r[c('team')] === team && r[c('number')] === no).map((r) => r[c('event')]);
    expect(rowsOf('opp', '33')).toEqual(['FG3', 'FG2', 'FTM', 'FTM']);
    expect(plays.filter((r) => r[c('number')] === '33').map((r) => [r[c('team')], r[c('player')], r[c('side')]]))
      .toEqual(Array(4).fill(['opp', '', 'away']));
    expect(rowsOf('opp', '24')).toEqual(Array(5).fill('FOUL'));
    // The same number on both teams stays apart.
    expect(rowsOf('us', '4')).toEqual(['FG2', 'FG2']);
    expect(rowsOf('opp', '4')).toEqual(['FG3', 'FTM']);

    // Their four Full timeouts, no number, on their side.
    expect(plays.filter((r) => r[c('event')] === 'TIMEOUT').map((r) => [r[c('team')], r[c('side')], r[c('detail')]]))
      .toEqual(Array(4).fill(['opp', 'away', 'full']));

    // The fixed FT is the one edit, and it now reads FTM; the added foul is the last Q2 row.
    const edited = plays.filter((r) => r[c('edited')] === 'yes');
    expect(edited.map((r) => [r[c('period')], r[c('team')], r[c('number')], r[c('event')]])).toEqual([['Q2', 'us', '00', 'FTM']]);
    const q2 = plays.filter((r) => r[c('period')] === 'Q2');
    expect(q2[q2.length - 1].slice(c('team'), c('event') + 1)).toEqual(['us', '31', 'Player Six', 'FOUL']);

    const last = plays[plays.length - 1];
    expect([last[c('us_score')], last[c('opp_score')]]).toEqual(['22', '18']);
  });
});

test('check: Add play covers the other team, by number or with no number', async ({ page }) => {
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  await app.fillOppRoster([{ number: '14', name: 'Rival Five' }, { number: '10', name: 'Rival Three' }]);
  await app.startGame();
  await app.score('Player One', '+2');
  await their(page, '10', ['+3']);
  await app.endPeriod('Q1');
  // The book has their 8; the app has 3. Ours matches.
  await app.checkQuarter('Q1', 2, 8);
  await app.expectAppHas('Q1', 2, 3, 2, 3);
  await expect(page.getByTestId('compare-opp')).toHaveText('Their score: book 8 · app 3 — 5 off');

  // The sheet opens on our team, so a one-team flow is unchanged; the player list is theirs after choosing Away.
  await app.fixRegion().getByRole('button', exact('Add play to Q1')).click();
  await expect(dialog.getByRole('group', exact('Team')).getByRole('button', exact('Home'))).toHaveClass(/bg-white/);
  await expect(dialog.getByRole('button', exact('#4 Player One'))).toBeVisible();
  await expect(dialog.getByRole('button', exact('#14 Rival Five'))).toHaveCount(0);
  await dialog.getByRole('group', exact('Team')).getByRole('button', exact('Away')).click();
  await expect(dialog.getByRole('button', exact('#4 Player One'))).toHaveCount(0);
  await expect(dialog.getByRole('button', exact('#14 Rival Five'))).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // The play sheet for a chosen player is titled with the team too, as on the Live screen.
  await app.fixRegion().getByRole('button', exact('Add play to Q1')).click();
  await dialog.getByRole('group', exact('Team')).getByRole('button', exact('Away')).click();
  await dialog.getByRole('button', { name: /^#14( |$)/ }).click();
  await expect(dialog).toHaveAccessibleName('#14 Rival Five (Away)');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await app.addTheirPlay('Q1', '14', '+2');
  await app.expectAppHas('Q1', 2, 5, 2, 5);
  await expect(page.getByTestId('compare-opp')).toHaveText('Their score: book 8 · app 5 — 3 off');
  await app.addTheirPlay('Q1', 'No number', '+3');
  await app.expectAppHas('Q1', 2, 8, 2, 8);
  await expect(page.getByTestId('compare-opp')).toHaveText('Their score: book 8 · app 8 ✓');
  await app.expectMatches();

  // A missed foul with no number is their team's: Away's Q1 team fouls go up by one, Home's do not.
  await expect(page.getByText(/^Team fouls in Q1 \(Away\):/)).toHaveText('Team fouls in Q1 (Away): 0');
  await app.addTheirPlay('Q1', 'No number', 'Foul');
  await expect(page.getByText(/^Team fouls in Q1 \(Away\):/)).toHaveText('Team fouls in Q1 (Away): 1');
  await expect(page.getByText(/^Team fouls in Q1 \(Home\):/)).toHaveText('Team fouls in Q1 (Home): 0');

  // The Log shows each in Q1, tagged Away.
  const q1 = app.fixRegion();
  await expect(app.logRow(q1, '#14 Rival Five (Away) · +2')).toHaveCount(1);
  await expect(app.logRow(q1, 'Away · +3')).toHaveCount(1);
  await expect(app.logRow(q1, 'Away · Foul')).toHaveCount(1);
});

test('a no-number free throw keeps the pair sheet open, but any other play there still asks Whose number?', async ({ page }) => {
  const app = ui(page);
  const dialog = page.getByRole('dialog');
  await page.goto('/');
  await app.fillSetup(OPPONENT, TEAM);
  await app.fillOppRoster([{ number: '14', name: 'Rival Five' }]);
  await app.startGame();
  await theirs(page).getByRole('button', exact('+ Play')).click();
  await dialog.getByRole('button', exact('FT made')).click();
  await dialog.getByRole('button', exact('No number')).click();
  // The team's sheet is back for the second shot: an FT records at once, with no question.
  await expect(dialog).toHaveAccessibleName('Away');
  // A +2 on that sheet is a new play, so it asks.
  await dialog.getByRole('button', exact('+2')).click();
  await expect(dialog).toHaveAccessibleName('Whose number?');
  await dialog.getByRole('button', exact('No number')).click();
  await expect(dialog).toHaveCount(0);
  await app.expectToast('Away +2');
});
