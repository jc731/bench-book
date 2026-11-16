import { expect, test, type Page } from '@playwright/test';
import { downloadCsv } from './csv';
import { TEAM, ui } from './fixture';

/*
 * A 60-point regulation game (31–29), played to find where the scorer taps most. It covers the
 * bonus in three quarters, a 5-foul foul-out and a 2-tech ejection with the out-player guard,
 * two bench techs, every timeout, and a quarter check after each period. Every expected number is
 * worked out BY HAND from the table; nothing here imports from src/.
 *
 * The opponent is left blank on Setup, so it becomes the game date as MM-DD.
 *
 *  per | event                                 |  Us | Opp | TF | notes
 *  ----+---------------------------------------+-----+-----+----+---------------------------
 *  Q1  | #4 +2                                 |   2 |   0 |  0 |
 *      | Opp +2                                |   2 |   2 |  0 |
 *      | #12 Foul                              |   2 |   2 |  1 | P4 1
 *      | #0 +3                                 |   5 |   2 |  1 |
 *      | Opp +2                                |   5 |   4 |  1 |
 *      | #12 Foul                              |   5 |   4 |  2 | P4 2
 *      | Timeout Full                          |     |     |    | Full 2
 *      | #00 FT made, FT made                  |   7 |   4 |  2 |
 *      | #23 Foul                              |   7 |   4 |  3 | P5 1
 *      | Opp +2                                |   7 |   6 |  3 |
 *      | #31 FT made, FT missed                |   8 |   6 |  3 | Q1 8–6, check 8/6 matched
 *  Q2  | #12 Foul                              |   8 |   6 |  1 | P4 3
 *      | #44 +2                                |  10 |   6 |  1 |
 *      | #4 Foul                               |  10 |   6 |  2 | P1 1
 *      | Opp +3                                |  10 |   9 |  2 |
 *      | #23 Foul                              |  10 |   9 |  3 | P5 2
 *      | #12 Foul                              |  10 |   9 |  4 | P4 4 -> warning
 *      | Bench tech                            |  10 |   9 |  5 | bonus; Bench 1 tech
 *      | Opp +1, Opp +1                        |  10 |  11 |  5 |
 *      | #0 +3                                 |  13 |  11 |  5 |
 *      | #00 Foul                              |  13 |  11 |  6 | P2 1
 *      | Opp +1                                |  13 |  12 |  6 |
 *      | Opp +2                                |  13 |  14 |  6 |
 *      | #4 +2                                 |  15 |  14 |  6 |
 *      | Timeout 30                            |     |     |    | 30s 1. Q2 7–8, check 15/14
 *  Q3  | #12 Foul                              |  15 |  14 |  1 | P4 5 -> OUT
 *      | Opp +1                                |  15 |  15 |  1 |
 *      | (tap #12: out warning, plays grayed)  |     |     |    | no event
 *      | #23 Tech foul                         |  15 |  15 |  2 | P5 3 fouls, 1 tech
 *      | Opp +1, Opp +1                        |  15 |  17 |  2 |
 *      | #31 +2                                |  17 |  17 |  2 |
 *      | #23 Tech foul                         |  17 |  17 |  3 | P5 2 techs -> OUT
 *      | Opp +1, Opp +1                        |  17 |  19 |  3 |
 *      | #44 +3                                |  20 |  19 |  3 |
 *      | #4 Foul                               |  20 |  19 |  4 | P1 2
 *      | #0 +2                                 |  22 |  19 |  4 |
 *      | #00 Foul                              |  22 |  19 |  5 | bonus; P2 2
 *      | Opp +1, Opp +1                        |  22 |  21 |  5 |
 *      | #00 FT made, FT made                  |  24 |  21 |  5 |
 *      | Timeout Full                          |     |     |    | Full 1. Q3 9–7, check 24/21
 *  Q4  | #12 +2 ANYWAY, then Undo              |  24 |  21 |  0 | not an event
 *      | #31 Foul                              |  24 |  21 |  1 | P6 1
 *      | Opp +2                                |  24 |  23 |  1 |
 *      | #4 +3                                 |  27 |  23 |  1 |
 *      | Bench tech                            |  27 |  23 |  2 | Bench 2 techs
 *      | Opp +1, Opp +1                        |  27 |  25 |  2 |
 *      | #0 Foul, #44 Foul, #31 Foul           |  27 |  25 |  5 | bonus; P3 1, P7 1, P6 2
 *      | Opp +1, Opp +1                        |  27 |  27 |  5 |
 *      | Timeout 30                            |     |     |    | 30s 0
 *      | #44 +2                                |  29 |  27 |  5 |
 *      | Opp +2                                |  29 |  29 |  5 |
 *      | #00 FT made, FT missed                |  30 |  29 |  5 |
 *      | Timeout Full                          |     |     |    | Full 0
 *      | #31 FT made, FT missed                |  31 |  29 |  5 | Q4 7–8. End game; check 31/29
 *
 * Events: Q1 13, Q2 15, Q3 18, Q4 19 = 65 (FT pairs and Opp +1 pairs count as two each).
 * Players:     FOULS TECHS 2'S 3'S FTA FTM TP
 *   #4  One      2     0    2   1   0   0   7
 *   #00 Two      2     0    0   0   6   5   5
 *   #0  Three    1     0    1   2   0   0   8
 *   #12 Four     5     0    0   0   0   0   0   OUT on 5 fouls
 *   #23 Five     4     2    0   0   0   0   0   OUT on 2 techs
 *   #31 Six      2     0    1   0   4   2   4
 *   #44 Seven    1     0    2   1   0   0   7
 *   TOTALS      17     2    6   4  10   7  31   (6*2 + 4*3 + 7 = 31)
 * Team fouls: Q1 3, Q2 6, Q3 5, Q4 5 = 19 = 17 player fouls + 2 bench techs.
 */

/** Counts real taps (trusted clicks) on the page, so the run can report what each part costs. */
async function countTaps(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __taps: number }).__taps = 0;
    window.addEventListener('click', (e) => { if (e.isTrusted) (window as unknown as { __taps: number }).__taps++; }, true);
  });
  return () => page.evaluate(() => (window as unknown as { __taps: number }).__taps);
}

test('bonus game: 31–29 with foul-outs, bench techs and every timeout', async ({ page }) => {
  const app = ui(page);
  const taps = await countTaps(page);
  const cost: [string, number][] = [];
  let mark = 0;
  const tally = async (what: string) => {
    const now = await taps();
    cost.push([what, now - mark]);
    mark = now;
  };
  let opponent = '';

  await test.step('setup: opponent left blank', async () => {
    await page.goto('/');
    await app.fillSetupNoOpponent(TEAM);
    opponent = await app.defaultOpponent();
    // The default is said in words, never as a gray "11-16" that reads as a score (UX audit v0.6.0, F5).
    const opp = page.getByLabel('Opponent (optional)');
    await expect(opp).not.toHaveAttribute('placeholder');
    await expect(opp).toHaveAccessibleDescription(`Left blank, the game is named ${opponent}`);
    expect(opponent).toMatch(/^\d{2}-\d{2}$/);
    await app.startGame();
    await app.expectBenchTechs(0);
    await tally('setup (7 players)');
  });

  await test.step('Q1', async () => {
    await app.score('Player One', '+2');
    await app.opp(2);
    await app.foul('Player Four');
    await app.score('Player Three', '+3');
    await app.opp(2);
    await app.foul('Player Four');
    await app.timeout('Full');
    await app.ft('Player Two', true, true);
    await app.foul('Player Five');
    await app.opp(2);
    await app.ft('Player Six', true, false);
    await app.expectStrip({ us: 8, opp: 6, period: 'Q1', fouls: 3, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await tally('Q1 plays');
    await app.endPeriod('Q1');
    await app.checkQuarter('Q1', 8, 6);
    await app.expectMatches();
    await app.saveCheck();
    await tally('Q1 end + check');
  });

  await test.step('Q2: bonus on a bench tech', async () => {
    await app.foul('Player Four');
    await app.score('Player Seven', '+2');
    await app.foul('Player One');
    await app.opp(3);
    await app.foul('Player Five');
    await app.foul('Player Four');
    await app.expectWarning('Player Four');
    await app.expectStrip({ us: 10, opp: 9, period: 'Q2', fouls: 4, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await app.benchTech();
    await app.expectToast('Bench tech — bonus');
    await app.expectBenchTechs(1);
    await app.opp(1);
    await app.opp(1);
    await app.score('Player Three', '+3');
    await app.foul('Player Two');
    await app.opp(1);
    await app.opp(2);
    await app.score('Player One', '+2');
    await app.timeout('30s');
    await app.expectStrip({ us: 15, opp: 14, period: 'Q2', fouls: 6, bonus: true, timeouts: { full: 2, thirty: 1 } });
    await tally('Q2 plays');
    await app.endPeriod('Q2');
    await app.checkQuarter('Q2', 15, 14);
    await app.expectMatches();
    await app.saveCheck();
    await tally('Q2 end + check');
  });

  await test.step('Q3: a foul-out, a 2-tech ejection, the out guard', async () => {
    await app.foul('Player Four');
    await app.expectToast('#12 Player Four foul — 5th, out');
    await app.expectPlayer('Player Four', 0, 5, true);
    await app.opp(1);
    await app.expectOutGuard('Player Four', '5 fouls');
    await app.expectStrip({ us: 15, opp: 15, period: 'Q3', fouls: 1, bonus: false, timeouts: { full: 2, thirty: 1 } });
    await app.tech('Player Five');
    await app.opp(1);
    await app.opp(1);
    await app.score('Player Six', '+2');
    await app.tech('Player Five');
    await app.expectToast('#23 Player Five tech foul — 2nd tech, out');
    await app.expectPlayer('Player Five', 0, 4, true);
    await app.expectOutGuard('Player Five', '2 techs');
    await app.opp(1);
    await app.opp(1);
    await app.score('Player Seven', '+3');
    await app.foul('Player One');
    await app.score('Player Three', '+2');
    await app.foul('Player Two');
    await app.opp(1);
    await app.opp(1);
    await app.ft('Player Two', true, true);
    await app.timeout('Full');
    await app.expectStrip({ us: 24, opp: 21, period: 'Q3', fouls: 5, bonus: true, timeouts: { full: 1, thirty: 1 } });
    await tally('Q3 plays (2 guard looks)');
    await app.endPeriod('Q3');
    await app.checkQuarter('Q3', 24, 21);
    await app.expectMatches();
    await app.saveCheck();
    await tally('Q3 end + check');
  });

  await test.step('Q4: past the guard and undone; a second bench tech; End game', async () => {
    await app.anyway('Player Four', '+2');
    await app.expectStrip({ us: 26, opp: 21, period: 'Q4', fouls: 0, bonus: false, timeouts: { full: 1, thirty: 1 } });
    await app.undo();
    await app.expectPlayer('Player Four', 0, 5, true);
    await app.foul('Player Six');
    await app.opp(2);
    await app.score('Player One', '+3');
    await app.benchTech();
    await app.expectBenchTechs(2);
    await app.opp(1);
    await app.opp(1);
    await app.foul('Player Three');
    await app.foul('Player Seven');
    await app.foul('Player Six');
    await app.opp(1);
    await app.opp(1);
    await app.timeout('30s');
    await app.score('Player Seven', '+2');
    await app.opp(2);
    await app.ft('Player Two', true, false);
    await app.timeout('Full');
    await app.ft('Player Six', true, false);
    await app.expectStrip({ us: 31, opp: 29, period: 'Q4', fouls: 5, bonus: true, timeouts: { full: 0, thirty: 0 } });
    await tally('Q4 plays (1 anyway + undo)');
    await app.endPeriodThen('Q4', 'End game (no overtime)');
    await expect(page.getByTestId('final-us')).toHaveText(`${TEAM} 31`);
    await expect(page.getByTestId('final-them')).toHaveText(`${opponent} 29`);
    await app.reopen('Q4', 'pending');
    await app.fillCheck('Q4', 31, 29);
    await app.expectMatches();
    await app.saveCheck();
    await tally('End game + Q4 check');
  });

  await test.step('Book CSV and Plays CSV', async () => {
    const rows = await downloadCsv(page, app.exportButton('Book CSV'));
    const at = (first: string) => rows.findIndex((r) => r[0] === first);
    const score = at('Score by period (running score after each)');
    expect(rows[score + 1]).toEqual(['', 'Q1', 'Q2', 'Q3', 'Q4', 'Final']);
    expect(rows[score + 2]).toEqual([TEAM, '8', '15', '24', '31', '31']);
    expect(rows[score + 3]).toEqual([opponent, '6', '14', '21', '29', '29']);

    const header = rows[at('POS')];
    const col = (name: string) => header.indexOf(name);
    const stats = (name: string) => {
      const r = rows.find((x) => x[1] === name)!;
      return ['FOULS', 'TECHS', "2'S", "3'S", 'FTA', 'FTM', 'TP'].map((k) => r[col(k)]).join(' ');
    };
    expect(stats('Player One')).toBe('2 0 2 1 0 0 7');
    expect(stats('Player Two')).toBe('2 0 0 0 6 5 5');
    expect(stats('Player Three')).toBe('1 0 1 2 0 0 8');
    expect(stats('Player Four')).toBe('5 0 0 0 0 0 0');
    expect(stats('Player Five')).toBe('4 2 0 0 0 0 0');
    expect(stats('Player Six')).toBe('2 0 1 0 4 2 4');
    expect(stats('Player Seven')).toBe('1 0 2 1 0 0 7');
    const totals = rows[at('TEAM TOTALS')];
    expect(['FOULS', 'TECHS', "2'S", "3'S", 'FTA', 'FTM', 'TP'].map((k) => totals[col(k)]).join(' ')).toBe('17 2 6 4 10 7 31');

    expect(rows.filter((r) => r[0] === 'Team fouls').map((r) => r[2])).toEqual(['3', '6', '5', '5']);
    expect(rows[at('Bench technicals')]).toEqual(['Bench technicals', '2']);
    expect(rows.filter((r) => r[0] === 'Timeouts used').map((r) => r[2])).toEqual(['3 of 3', '2 of 2', '0 of 0']);
    const rec = at('Reconcile');
    expect(rows.slice(rec + 2).map((r) => r[7])).toEqual(['matched', 'matched', 'matched', 'matched']);

    const [h, ...plays] = await downloadCsv(page, app.exportButton('Plays CSV'));
    const per = (p: string) => plays.filter((r) => r[h.indexOf('period')] === p).length;
    expect(['Q1', 'Q2', 'Q3', 'Q4'].map(per)).toEqual([13, 15, 18, 19]);
    await tally('export both CSVs');
  });

  // The cost report: taps per part of the game, for spotting where the scorer works hardest.
  const total = cost.reduce((n, [, t]) => n + t, 0);
  const report = [...cost.map(([w, t]) => `${String(t).padStart(4)}  ${w}`), `${String(total).padStart(4)}  total`].join('\n');
  test.info().annotations.push({ type: 'taps', description: report });
  console.log(`\nTaps per part of the bonus game:\n${report}`);
});
