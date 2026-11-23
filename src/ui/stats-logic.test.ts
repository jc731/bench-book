import { describe, expect, test } from 'vitest';
import { appendEvent, newGame, recordSub } from '../core/events';
import { derive } from '../core/derive';
import { lineup } from '../core/lineup';
import { endGame, endPeriod, markExported, oppTotal, saveReconcile } from '../core/reconcile';
import type { Game, GameInfo, Player, Side } from '../core/types';
import { applyLabeled } from './game-state';
import type { PlayType } from './live-logic';
import {
  addFeedback, addToCell, cellPlays, cellTappable, cellTitle, sideOrder, statsGrid, toggleText, totalText, type StatsGrid,
} from './stats-logic';

// Invented teams and players only (the repo is public).
const info: GameInfo = {
  team: 'Maple Hill', opponent: 'Cedar Run', date: '2026-11-19', homeAway: 'home',
  coach: 'Coach Pell', scorer: 'Scorer Ames', timer: 'Timer Rudd',
};
const home: Player[] = [
  { id: 'h1', number: '1', name: 'Avery Lind', pos: 'G' },
  { id: 'h2', number: '2', name: 'Jordan Pike', pos: 'G' },
  { id: 'h3', number: '3', name: 'Riley Shaw', pos: 'F' },
  { id: 'h4', number: '4', name: 'Quinn Doyle', pos: 'F' },
  { id: 'h5', number: '5', name: 'Casey Moreno', pos: 'C' },
  { id: 'h6', number: '6', name: 'Morgan Tate', pos: 'G' },
  { id: 'h7', number: '7', name: 'Drew Hale', pos: 'F' },
];
const away: Player[] = [
  { id: 'a14', number: '14', name: 'Robin Vale', pos: 'G' },
  { id: 'a22', number: '22', name: 'Sam Ortiz', pos: 'F' },
];
const t0 = new Date('2026-11-19T18:00:00Z');
const h5 = home[4];
const a14 = away[0];

function game(opts: { opp?: Player[]; homeAway?: 'home' | 'away' } = {}): Game {
  return newGame({ ...info, homeAway: opts.homeAway ?? 'home' }, home, t0, opts.opp ?? away);
}
function play(g: Game, type: PlayType | 'BENCH_TECH' | 'OPP_PTS', playerId: string | null, side: Side = 'us', period?: number): Game {
  return appendEvent(g, {
    type,
    ...(playerId ? { playerId } : {}),
    ...(side === 'them' && type !== 'OPP_PTS' ? { side: 'them' as const } : {}),
    ...(type === 'OPP_PTS' ? { oppPoints: 2 as const } : {}),
    ...(period ? { period } : {}),
  }, t0);
}
const times = (g: Game, n: number, f: (g: Game) => Game): Game => {
  for (let i = 0; i < n; i++) g = f(g);
  return g;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Bench techs by period, counted straight from the event log (the source I2 names). */
function benchTechsIn(g: Game, side: Side, period: number): number {
  return g.events.filter((e) => e.type === 'BENCH_TECH' && (e.side === 'them' ? 'them' : 'us') === side && e.period === period).length;
}

/** I1, I2, I3 (no typed opponent total), I7 for one game. */
function checkInvariants(g: Game): void {
  const d = derive(g);
  const grids = { us: statsGrid(g, 'us'), them: statsGrid(g, 'them') };
  for (const side of ['us', 'them'] as const) {
    const grid = grids[side];
    grid.periods.forEach((p, i) => {
      // I1: player rows plus No number sum to the Team row's points.
      expect(sum(grid.rows.map((r) => r.cells[i].points))).toBe(grid.team.points[i]);
      // I2: player rows' fouls + No number fouls + bench techs = the Team row's fouls.
      expect(sum(grid.rows.map((r) => r.cells[i].fouls)) + benchTechsIn(g, side, p)).toBe(grid.team.fouls[i]);
    });
    expect(sum(grid.rows.map((r) => r.points))).toBe(grid.team.total);
    // I7: foulsByPeriod summed over periods equals fouls, for every player line and the No number line.
    const team = side === 'us' ? d.us : d.opp;
    for (const line of [...team.players, ...(team.noNumber ? [team.noNumber] : [])]) {
      expect(sum(Object.values(line.foulsByPeriod))).toBe(line.fouls);
    }
  }
  // I3: the Score row is the running sum of both Team rows...
  const grid = grids.us;
  const homeSide = g.info.homeAway === 'home' ? 'us' : 'them';
  const awaySide = homeSide === 'us' ? 'them' : 'us';
  const running = (pts: number[]) => pts.map((_, i) => sum(pts.slice(0, i + 1)));
  expect(grid.score.home).toEqual(running(grids[homeSide].team.points));
  expect(grid.score.away).toEqual(running(grids[awaySide].team.points));
  // ...and its last column equals the strip's score: `derive` for us, `oppTotal` for them (no typed opponent total here).
  const strip = { us: d.usTotal, them: oppTotal(g) };
  expect(grid.score.home.at(-1)).toBe(strip[homeSide]);
  expect(grid.score.away.at(-1)).toBe(strip[awaySide]);
}

const rowOf = (grid: StatsGrid, key: string) => grid.rows.find((r) => r.key === key)!;

describe('statsGrid', () => {
  test('I1, I2, I3: a small game with No number plays and a bench tech', () => {
    let g = game();
    g = play(g, 'FG2', 'h1');
    g = play(g, 'FG3', null);
    g = play(g, 'FOUL', 'h2');
    g = play(g, 'BENCH_TECH', null);
    g = play(g, 'FG2', 'a14', 'them');
    g = play(g, 'FOUL', null, 'them');
    g = endPeriod(g, t0);
    g = play(g, 'TECH', 'h3');
    g = play(g, 'FTM', 'a22', 'them');
    checkInvariants(g);
    const us = statsGrid(g, 'us');
    // D4: roster order, then No number because our team has a no-number play.
    expect(us.rows.map((r) => r.key)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'none']);
    expect(rowOf(us, 'none').player).toBeNull();
    // Team row Q1: 2 + 3 points; fouls: h2's foul + the bench tech (I2).
    expect(us.team.points).toEqual([5, 0, 0, 0]);
    expect(us.team.fouls).toEqual([2, 1, 0, 0]);
    expect(us.team.total).toBe(5);
    expect(us.team.totalFouls).toBe(3);
    // D7 counts techs among fouls; techs counted apart.
    expect(rowOf(us, 'h3')).toMatchObject({ fouls: 1, techs: 1, points: 0 });
  });

  test('D4: the score is kept as Home and Away, whichever side we are', () => {
    let g = game({ homeAway: 'away' });
    g = play(g, 'FG2', 'h1');
    g = play(g, 'FG3', 'a14', 'them');
    const grid = statsGrid(g, 'us');
    // We are Away: Home is them (3), Away is us (2).
    expect(grid.score).toEqual({ home: [3, 3, 3, 3], away: [2, 2, 2, 2] });
    checkInvariants(g);
  });

  test('D4 / Review Focus 3: an opponent with no roster and two No number plays is one No number row; I1 holds', () => {
    let g = game({ opp: [] });
    g = play(g, 'FG2', null, 'them');
    g = play(g, 'FOUL', null, 'them');
    const them = statsGrid(g, 'them');
    expect(them.rows.map((r) => r.key)).toEqual(['none']);
    expect(them.rows[0].cells[0]).toEqual({ points: 2, fouls: 1, empty: false });
    checkInvariants(g);
  });

  test('D4: No number is absent when the team has no no-number play', () => {
    const g = play(game(), 'FG2', 'h1');
    expect(statsGrid(g, 'us').rows.some((r) => r.key === 'none')).toBe(false);
  });

  test('D3 / Review Focus 4: period 5 shows Q1–OT1 with an empty OT1; an ended Q4 game shows Q1–Q4', () => {
    let g = play(game(), 'FG2', 'h1');
    g = times(g, 4, (x) => endPeriod(x, t0));
    expect(g.currentPeriod).toBe(5);
    const ot = statsGrid(g, 'us');
    expect(ot.periods).toEqual([1, 2, 3, 4, 5]);
    expect(ot.rows.every((r) => r.cells[4].empty)).toBe(true);
    expect(ot.team.points).toHaveLength(5);
    let q4 = play(game(), 'FG2', 'h1');
    q4 = endGame(times(q4, 3, (x) => endPeriod(x, t0)), t0);
    expect(statsGrid(q4, 'us').periods).toEqual([1, 2, 3, 4]);
  });

  test('D6: only a missed free throw is a 0 cell, not empty; no plays is empty', () => {
    let g = endPeriod(game(), t0);
    g = play(g, 'FTX', 'h1');
    const row = rowOf(statsGrid(g, 'us'), 'h1');
    expect(row.cells[1]).toEqual({ points: 0, fouls: 0, empty: false });
    expect(row.cells[0]).toEqual({ points: 0, fouls: 0, empty: true });
  });

  test('foulState follows derive: warn at 4, out at 5 (D5)', () => {
    let g = times(game(), 4, (x) => play(x, 'FOUL', 'h1'));
    expect(rowOf(statsGrid(g, 'us'), 'h1').foulState).toBe('warn');
    g = play(g, 'FOUL', 'h1');
    expect(rowOf(statsGrid(g, 'us'), 'h1').foulState).toBe('out');
  });

  test('I3 (amended): a typed opponent total that differs from their recorded points shows on the strip, not the Score row', () => {
    let g = play(game(), 'FG2', 'h1');
    g = play(g, 'FG2', 'a14', 'them');
    g = play(g, 'FG2', 'a14', 'them'); // their recorded Q1: 4
    g = saveReconcile(g, 1, 2, 6, '', t0); // the book says 6
    g = endPeriod(g, t0);
    const grid = statsGrid(g, 'us');
    // The Score row is what was recorded (4); the strip reads the book's 6 (`oppTotal`). The spec allows exactly this gap.
    expect(grid.score.away.at(-1)).toBe(4);
    expect(oppTotal(g)).toBe(6);
    expect(grid.score.home.at(-1)).toBe(derive(g).usTotal);
  });

  test('I4: an add to Q2 changes only that cell, its row total, the Team row Q2 and totals, and the Score row from Q2 on', () => {
    let g = play(game(), 'FG2', 'h1');
    g = play(g, 'FG2', 'a14', 'them');
    g = endPeriod(g, t0);
    g = play(g, 'FG3', 'h5');
    g = endPeriod(g, t0);
    g = play(g, 'FOUL', 'h5');
    const before = statsGrid(g, 'us');
    const after = statsGrid(addToCell(g, 'us', 'h5', 'FG2', 2, t0), 'us');
    expect(after.periods).toEqual(before.periods);
    expect(after.rows.map((r) => r.key)).toEqual(before.rows.map((r) => r.key));
    after.rows.forEach((r, ri) => {
      const b = before.rows[ri];
      r.cells.forEach((c, ci) => {
        if (r.key === 'h5' && ci === 1) expect(c).toEqual({ ...b.cells[ci], points: b.cells[ci].points + 2, empty: false });
        else expect(c).toEqual(b.cells[ci]);
      });
      if (r.key === 'h5') expect(r.points).toBe(b.points + 2);
      else expect(r).toEqual(b);
    });
    expect(after.team.points).toEqual(before.team.points.map((n, i) => (i === 1 ? n + 2 : n)));
    expect(after.team.fouls).toEqual(before.team.fouls);
    expect(after.team.total).toBe(before.team.total + 2);
    expect(after.score.home).toEqual(before.score.home.map((n, i) => (i >= 1 ? n + 2 : n)));
    expect(after.score.away).toEqual(before.score.away);
    // The other team's grid is untouched.
    const themBefore = statsGrid(g, 'them');
    const themAfter = statsGrid(addToCell(g, 'us', 'h5', 'FG2', 2, t0), 'them');
    expect(themAfter.rows).toEqual(themBefore.rows);
    expect(themAfter.team).toEqual(themBefore.team);
  });
});

describe('critique 7: invariants over every prefix of a long generated game', () => {
  test('I1, I2, I3, I7 hold after each of 60+ steps across Q1–OT1, with subs, No number, a bench tech and a legacy OPP_PTS', () => {
    // A fixed LCG, so the game is the same on every run.
    let seed = 20261119;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % n; // the high bits: an LCG's low bits cycle
    };
    const types: PlayType[] = ['FG2', 'FG2', 'FG3', 'FTM', 'FTX', 'FOUL', 'FOUL', 'TECH'];
    let g = game();
    let steps = 0;
    let events = 0;
    const step = (next: Game) => {
      g = next;
      steps++;
      checkInvariants(g);
    };
    for (let i = 0; i < 80; i++) {
      if (i > 0 && i % 16 === 0) step(endPeriod(g, t0)); // reaches period 5 (OT1) at i = 64
      if (i === 10) step(play(g, 'BENCH_TECH', null));
      if (i === 20) step(play(g, 'OPP_PTS', null, 'them'));
      if (i === 30) step(addToCell(g, 'them', null, 'FG3', g.currentPeriod, t0));
      if (i === 40) step(addToCell(g, 'us', null, 'FOUL', g.currentPeriod, t0));
      if (i % 9 === 4) step(recordSub(g, 'us', ['h6'], ['h1'], t0));
      if (i % 9 === 8) step(recordSub(g, 'us', ['h1'], ['h6'], t0));
      const side: Side = rand(2) === 0 ? 'us' : 'them';
      const roster = side === 'us' ? home : away;
      const pick = rand(roster.length + 1);
      const playerId = pick === roster.length ? null : roster[pick].id;
      const type = types[rand(types.length)];
      // Every seventh play goes to an earlier quarter from a cell, as a late add.
      const period = i % 7 === 6 && g.currentPeriod > 1 ? 1 + rand(g.currentPeriod - 1) : g.currentPeriod;
      step(addToCell(g, side, playerId, type, period, t0));
      events++;
    }
    expect(g.currentPeriod).toBe(5);
    expect(g.events.length).toBeGreaterThanOrEqual(60);
    expect(events + 4).toBe(g.events.length);
    expect(steps).toBeGreaterThan(80);
    // The generator did reach every case it names.
    expect(g.events.some((e) => e.type === 'OPP_PTS')).toBe(true);
    expect(g.events.some((e) => e.type === 'BENCH_TECH')).toBe(true);
    expect(g.events.some((e) => !e.playerId && e.side === 'them' && e.type !== 'OPP_PTS')).toBe(true);
    expect(g.events.some((e) => !e.playerId && !e.side && e.type === 'FOUL')).toBe(true);
    expect(g.events.some((e) => e.type === 'TECH')).toBe(true);
    expect(g.events.some((e) => e.period === 5)).toBe(true);
    expect(g.events.some((e) => e.late)).toBe(true);
    expect((g.subs ?? []).length).toBeGreaterThan(0);
  });
});

describe('sideOrder, totalText, cellTitle, cellPlays', () => {
  test('D2: Home first', () => {
    expect(sideOrder(game())).toEqual(['us', 'them']);
    expect(sideOrder(game({ homeAway: 'away' }))).toEqual(['them', 'us']);
  });

  test('Our team on the left (owner, 2026-11-23): ours first, home or away; off keeps Home first', () => {
    expect(sideOrder(game(), true)).toEqual(['us', 'them']);
    expect(sideOrder(game({ homeAway: 'away' }), true)).toEqual(['us', 'them']);
    expect(sideOrder(game({ homeAway: 'away' }), false)).toEqual(['them', 'us']);
  });

  test('D7: F 3, F 4 (warn), OUT at 5, T 1 with a tech', () => {
    const at = (fouls: number, techs = 0) => {
      let g = times(game(), fouls - techs, (x) => play(x, 'FOUL', 'h1'));
      g = times(g, techs, (x) => play(x, 'TECH', 'h1'));
      return totalText(rowOf(statsGrid(g, 'us'), 'h1'));
    };
    expect(at(3)).toEqual({ points: '0', fouls: 'F 3', tech: null });
    expect(at(4)).toEqual({ points: '0', fouls: 'F 4', tech: null });
    expect(at(5)).toEqual({ points: '0', fouls: 'OUT', tech: null });
    expect(at(1, 1)).toEqual({ points: '0', fouls: 'F 1', tech: 'T 1' });
  });

  test('D9: the sheet title names the player, team and quarter; No number the same way', () => {
    const g = game();
    expect(cellTitle(g, 'us', h5, 2)).toBe('#5 Casey Moreno (Home) · Q2');
    expect(cellTitle(g, 'us', null, 2)).toBe('No number (Home) · Q2');
    expect(cellTitle(g, 'them', a14, 5)).toBe('#14 Robin Vale (Away) · OT1');
  });

  test('D9: a cell lists its plays oldest first, a late add sorting with its quarter', () => {
    let g = play(game(), 'FG2', 'h5');
    g = play(g, 'FOUL', 'h5');
    g = play(g, 'FG2', 'h1');
    g = endPeriod(g, t0);
    g = play(g, 'FG3', 'h5');
    g = addToCell(g, 'us', 'h5', 'FTM', 1, t0);
    expect(cellPlays(g, 'us', 'h5', 1).map((e) => e.type)).toEqual(['FG2', 'FOUL', 'FTM']);
    expect(cellPlays(g, 'us', 'h5', 2).map((e) => e.type)).toEqual(['FG3']);
  });

  test('D9: the No number cell lists that team\'s plays with no player, legacy opponent points included, not bench techs', () => {
    let g = play(game(), 'FG2', null, 'them');
    g = play(g, 'OPP_PTS', null, 'them');
    g = play(g, 'BENCH_TECH', null, 'them');
    g = play(g, 'FG2', null);
    expect(cellPlays(g, 'them', null, 1).map((e) => e.type)).toEqual(['FG2', 'OPP_PTS']);
    expect(cellPlays(g, 'us', null, 1).map((e) => e.type)).toEqual(['FG2']);
  });
});

describe('addToCell', () => {
  test('D10: an add to the current period puts a bench player on the floor; to an earlier period it does not (D11)', () => {
    let g = play(game(), 'FG2', 'h1');
    g = endPeriod(g, t0);
    expect(lineup(g, 'us').floor).not.toContain('h7');
    const now = addToCell(g, 'us', 'h7', 'FG2', 2, t0);
    expect(lineup(now, 'us').floor).toContain('h7');
    const late = addToCell(g, 'us', 'h7', 'FG2', 1, t0);
    expect(lineup(late, 'us').floor).not.toContain('h7');
    expect(late.events.at(-1)).toMatchObject({ type: 'FG2', playerId: 'h7', period: 1, late: true });
    expect(now.events.at(-1)!.late).toBeUndefined();
  });

  test('D10: the add goes at the end of its quarter, on the right side', () => {
    let g = play(game(), 'FG2', 'h1');
    g = endPeriod(g, t0);
    g = play(g, 'FG2', 'h1');
    g = addToCell(g, 'them', 'a14', 'FOUL', 1, t0);
    const added = g.events.at(-1)!;
    expect(added).toMatchObject({ side: 'them', playerId: 'a14', period: 1, type: 'FOUL' });
    const q1 = g.events.find((e) => e.period === 1 && e.id !== added.id)!;
    const q2 = g.events.find((e) => e.period === 2)!;
    expect(added.order).toBeGreaterThan(q1.order);
    expect(added.order).toBeLessThan(q2.order);
  });

  test('D10: a No number add carries no player', () => {
    const g = addToCell(game(), 'them', null, 'FG2', 1, t0);
    expect(g.events[0].playerId).toBeUndefined();
    expect(g.events[0].side).toBe('them');
  });

  test('I6 / D13: applyLabeled on an exported, ended game keeps endedAt and clears exported', () => {
    let g = endGame(play(game(), 'FG2', 'h1'), t0);
    g = markExported(markExported(g, 'book', t0), 'plays', t0);
    const r = applyLabeled({ game: g, stack: [] }, (x, now) => addToCell(x, 'us', 'h5', 'FOUL', 2, now), 'Added', t0);
    expect(r.state.game!.endedAt).toBe(g.endedAt);
    expect(r.state.game!.exported).toBeUndefined();
    expect(r.state.game!.events.at(-1)!.late).toBe(true);
  });
});

describe('addFeedback (D12)', () => {
  const fb = (before: Game, side: Side, player: Player | null, type: PlayType, period: number) =>
    addFeedback(before, addToCell(before, side, player?.id ?? null, type, period, t0), side, player, type, period);

  test('base: the check\'s wording, plain', () => {
    const g = endPeriod(game(), t0);
    expect(fb(g, 'us', h5, 'FOUL', 1)).toEqual({ text: 'Added #5 (Home) Foul to Q1', tone: 'plain' });
    expect(fb(g, 'them', null, 'FG2', 1)).toEqual({ text: 'Added Away +2 to Q1', tone: 'plain' });
  });

  test('a 5th foul added to Q2 is the live out text, red, ending "Tell the official."', () => {
    let g = times(game(), 4, (x) => play(x, 'FOUL', 'h5'));
    g = endPeriod(endPeriod(g, t0), t0);
    const r = fb(g, 'us', h5, 'FOUL', 2);
    expect(r).toEqual({ text: '#5 Casey Moreno (Home) out, 5 fouls. Tell the official.', tone: 'red' });
  });

  test('a 2nd tech added late is the live out text with 2 techs, red', () => {
    let g = play(game(), 'TECH', 'h5');
    g = endPeriod(g, t0);
    expect(fb(g, 'us', h5, 'TECH', 1)).toEqual({ text: '#5 Casey Moreno (Home) out, 2 techs. Tell the official.', tone: 'red' });
  });

  test('an add that breaks a matched Q2 check: `· Q2 check now 2 over`, amber', () => {
    let g = play(game(), 'FG2', 'h1');
    g = saveReconcile(g, 1, 2, null, '', t0);
    g = endPeriod(g, t0);
    g = play(g, 'FG2', 'h5');
    g = saveReconcile(g, 2, 4, null, '', t0); // book typed equal to the app
    g = endPeriod(g, t0);
    expect(fb(g, 'us', h5, 'FG2', 2)).toEqual({ text: 'Added #5 (Home) +2 to Q2 · Q2 check now 2 over', tone: 'amber' });
  });

  test('critique 5: Q2 has no check, Q3\'s check (span Q2–Q3) matched → an add to Q2 names the Q3 check', () => {
    let g = play(game(), 'FG2', 'h1');
    g = saveReconcile(g, 1, 2, null, '', t0);
    g = endPeriod(g, t0);
    g = play(g, 'FG2', 'h5');
    g = endPeriod(g, t0);
    g = play(g, 'FG3', 'h5');
    g = saveReconcile(g, 3, 7, null, '', t0);
    g = endPeriod(g, t0);
    expect(fb(g, 'us', h5, 'FG2', 2)).toEqual({ text: 'Added #5 (Home) +2 to Q2 · Q3 check now 2 over', tone: 'amber' });
    // A foul does not touch the check: checks compare points.
    expect(fb(g, 'us', h5, 'FOUL', 2)).toEqual({ text: 'Added #5 (Home) Foul to Q2', tone: 'plain' });
  });

  test('a check that was already off gets no suffix: only a matched check that stops matching is named', () => {
    let g = play(game(), 'FG2', 'h1');
    g = saveReconcile(g, 1, 6, null, '', t0); // book 6, app 2: off before the add
    g = endPeriod(g, t0);
    expect(fb(g, 'us', h5, 'FG2', 1)).toEqual({ text: 'Added #5 (Home) +2 to Q1', tone: 'plain' });
  });

  test('the opponent\'s check: their matched Q1 total, broken by their add, names the Q1 check', () => {
    let g = play(game(), 'FG2', 'a14', 'them');
    g = saveReconcile(g, 1, 0, 2, '', t0);
    g = endPeriod(g, t0);
    expect(fb(g, 'them', a14, 'FTM', 1)).toEqual({ text: 'Added #14 (Away) FT made to Q1 · Q1 check now 1 over', tone: 'amber' });
    // Our add to the same quarter breaks our check, not theirs: ours matched at 0.
    expect(fb(g, 'us', h5, 'FG2', 1)).toEqual({ text: 'Added #5 (Home) +2 to Q1 · Q1 check now 2 over', tone: 'amber' });
  });

  test('the opponent\'s 5th team foul of the current period adds the live bonus suffix', () => {
    let g = endPeriod(endPeriod(game(), t0), t0);
    g = times(g, 4, (x) => play(x, 'FOUL', 'a22', 'them'));
    expect(fb(g, 'them', a14, 'FOUL', 3)).toEqual({ text: 'Added #14 (Away) Foul to Q3 — bonus', tone: 'plain' });
  });

  test('a 5th team foul added to an earlier quarter does not change the current bonus: no suffix', () => {
    let g = endPeriod(game(), t0);
    g = times(g, 4, (x) => play(x, 'FOUL', 'a22', 'them', 1));
    g = endPeriod(g, t0);
    expect(fb(g, 'them', a14, 'FOUL', 1)).toEqual({ text: 'Added #14 (Away) Foul to Q1', tone: 'plain' });
  });
});

describe('cellTappable (controller ruling 2026-11-19: quarters not yet started take no adds)', () => {
  test('in Q2 of a game in progress, Q1 and Q2 are tappable and Q3, Q4 are not', () => {
    const g = endPeriod(game(), t0);
    expect(g.currentPeriod).toBe(2);
    expect([1, 2, 3, 4].map((p) => cellTappable(g, p))).toEqual([true, true, false, false]);
  });
  test('every quarter of an ended game is tappable (D13: an ended game accepts adds)', () => {
    const g = endGame(game(), t0);
    expect([1, 2, 3, 4].map((p) => cellTappable(g, p))).toEqual([true, true, true, true]);
  });
});

describe('toggleText (D2: each team name and score, as on the strip)', () => {
  test('a home game: Home is our team name and score, Away the opponent', () => {
    const g = play(play(game(), 'FG2', 'h5'), 'FG3', 'a14', 'them');
    expect(toggleText(g, 'us')).toBe('Maple Hill 2');
    expect(toggleText(g, 'them')).toBe('Cedar Run 3');
  });
  test('the opponent score is the strip score: a typed book total wins over recorded taps (I3 amended)', () => {
    let g = endPeriod(play(game(), 'OPP_PTS', null, 'them'), t0);
    g = saveReconcile(g, 1, 0, 5, '', t0);
    expect(toggleText(g, 'them')).toBe(`Cedar Run ${oppTotal(g)}`);
    expect(oppTotal(g)).toBe(5);
  });
  test('a blank team name falls back to its Home or Away tag', () => {
    const g = newGame({ ...info, team: '' }, home, t0, away);
    expect(toggleText(g, 'us')).toBe('Home 0');
  });
});
