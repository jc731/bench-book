import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { appendEvent, insertEventBefore, newGame, orderedEvents } from './events';
import type { EventDraft, Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [
  { id: 'p1', number: '1', name: 'Player One', pos: 'G' },
  { id: 'p2', number: '2', name: 'Player Two', pos: 'F' },
  { id: 'p3', number: '3', name: 'Player Three', pos: 'C' },
];
const now = new Date('2026-11-10T10:00:00Z');

function game(): Game {
  return newGame(info, roster, now);
}
function add(g: Game, period: number, ...drafts: EventDraft[]): Game {
  return drafts.reduce((acc, d) => appendEvent(acc, { ...d, period }, now), g);
}
function fouls(g: Game, period: number, n: number, playerId = 'p1'): Game {
  for (let i = 0; i < n; i++) g = add(g, period, { type: 'FOUL', playerId });
  return g;
}

describe('points', () => {
  test('FG2 + FG3 + FTM = 6; FTX adds 0 but counts as an attempt', () => {
    const g = add(game(), 1,
      { type: 'FG2', playerId: 'p1' }, { type: 'FG3', playerId: 'p1' },
      { type: 'FTM', playerId: 'p1' }, { type: 'FTX', playerId: 'p1' });
    const d = derive(g);
    const p = d.players[0];
    expect(p).toMatchObject({ playerId: 'p1', fg2: 1, fg3: 1, ftm: 1, fta: 2, points: 6 });
    expect(p.pointsByPeriod).toEqual({ 1: 6 });
    expect(p.marksByPeriod[1]).toEqual(['2', '3', 'FT', '0']);
    expect(d.usTotal).toBe(6);
    expect(d.usByPeriod).toEqual({ 1: 6 });
  });

  test('marks keep event order, not entry order, and per-period totals split correctly', () => {
    let g = add(game(), 1, { type: 'FG3', playerId: 'p1' });
    g = add(g, 2, { type: 'FG2', playerId: 'p1' }, { type: 'FTM', playerId: 'p2' });
    g = insertEventBefore(g, orderedEvents(g)[0].id, { type: 'FTM', playerId: 'p1' }, now);
    const d = derive(g);
    expect(d.players[0].marksByPeriod).toEqual({ 1: ['FT', '3'], 2: ['2'] });
    expect(d.players[0].pointsByPeriod).toEqual({ 1: 4, 2: 2 });
    expect(d.players[1].points).toBe(1);
    expect(d.usByPeriod).toEqual({ 1: 4, 2: 3 });
    expect(d.usTotal).toBe(7);
  });

  test('players come back in roster order, with empty lines for players without events', () => {
    const d = derive(add(game(), 1, { type: 'FG2', playerId: 'p3' }));
    expect(d.players.map((p) => p.playerId)).toEqual(['p1', 'p2', 'p3']);
    expect(d.players[0]).toMatchObject({ points: 0, fouls: 0, techs: 0, foulState: 'ok' });
    expect(d.players[0].pointsByPeriod).toEqual({});
    expect(d.players[0].marksByPeriod).toEqual({});
    expect(d.players[2].points).toBe(2);
  });

  test('opponent score comes from OPP_PTS taps only, by period', () => {
    const g = add(game(), 1, { type: 'OPP_PTS', oppPoints: 3 }, { type: 'OPP_PTS', oppPoints: 2 },
      { type: 'FG2', playerId: 'p1' });
    const d = derive(add(g, 2, { type: 'OPP_PTS', oppPoints: 1 }));
    expect(d.oppByPeriod).toEqual({ 1: 5, 2: 1 });
    expect(d.oppTotal).toBe(6);
    expect(d.usTotal).toBe(2);
    expect(d.usByPeriod).toEqual({ 1: 2 });
  });

  test('empty game has empty maps and zero totals', () => {
    const d = derive(game());
    expect(d).toMatchObject({ usByPeriod: {}, oppByPeriod: {}, usTotal: 0, oppTotal: 0,
      teamFoulsByPeriod: {}, benchTechs: 0 });
  });

  test('third OT: usByPeriod[7] exists once an event is in it', () => {
    const g = { ...add(game(), 7, { type: 'FG3', playerId: 'p1' }), currentPeriod: 7 };
    const d = derive(g);
    expect(d.usByPeriod[7]).toBe(3);
    expect(d.timeouts.ot.total).toBe(3);
  });
});

describe('team fouls and bonus', () => {
  test('foul inserted into Q1 counts in Q1', () => {
    let g = add(game(), 1, { type: 'FG2', playerId: 'p1' });
    g = fouls(g, 2, 2);
    g = insertEventBefore(g, orderedEvents(g)[0].id, { type: 'FOUL', playerId: 'p2' }, now);
    expect(derive(g).teamFoulsByPeriod).toEqual({ 1: 1, 2: 2 });
  });

  test('bonus flips on exactly the 5th team foul', () => {
    expect(derive(fouls(game(), 1, 4)).oppInBonus(1)).toBe(false);
    expect(derive(fouls(game(), 1, 5)).oppInBonus(1)).toBe(true);
    expect(derive(fouls(game(), 1, 5)).teamFoulsForBonus(1)).toBe(5);
  });

  test('reset: 4 fouls in Q1 then 1 in Q2 is not bonus in Q2', () => {
    const d = derive(fouls(fouls(game(), 1, 4), 2, 1));
    expect(d.oppInBonus(2)).toBe(false);
    expect(d.teamFoulsForBonus(2)).toBe(1);
    expect(d.oppInBonus(1)).toBe(false);
  });

  test('OT carry: Q4 + OT1 count together, Q3 does not carry, asked period bounds the sum', () => {
    let g = fouls(game(), 3, 4);
    g = fouls(g, 4, 3);
    g = fouls(g, 5, 2);
    const d = derive(g);
    expect(d.teamFoulsForBonus(5)).toBe(5);
    expect(d.oppInBonus(5)).toBe(true);
    expect(d.oppInBonus(4)).toBe(false);
    expect(d.teamFoulsForBonus(4)).toBe(3);
    expect(d.teamFoulsForBonus(3)).toBe(4);
  });

  test('OT carry across OT1 and OT2 sums Q4 + OT1 + OT2 and ignores later periods', () => {
    let g = fouls(game(), 3, 5);
    g = fouls(g, 4, 2);
    g = fouls(g, 5, 1);
    g = fouls(g, 6, 1);
    g = fouls(g, 7, 4);
    const d = derive(g);
    expect(d.teamFoulsForBonus(6)).toBe(4);
    expect(d.oppInBonus(6)).toBe(false);
    expect(d.teamFoulsForBonus(5)).toBe(3);
    expect(d.teamFoulsForBonus(7)).toBe(8);
    expect(d.teamFoulsForBonus(3)).toBe(5);
  });

  test('a period with no fouls reads 0', () => {
    const d = derive(fouls(game(), 1, 5));
    expect(d.teamFoulsForBonus(2)).toBe(0);
    expect(d.oppInBonus(2)).toBe(false);
  });

  test('technicals: player TECH + BENCH_TECH are 2 team fouls; player has fouls 1, techs 1', () => {
    const g = add(game(), 1, { type: 'TECH', playerId: 'p1' }, { type: 'BENCH_TECH' });
    const d = derive(g);
    expect(d.teamFoulsByPeriod).toEqual({ 1: 2 });
    expect(d.benchTechs).toBe(1);
    expect(d.players[0]).toMatchObject({ fouls: 1, techs: 1 });
    expect(d.players[1]).toMatchObject({ fouls: 0, techs: 0 });
  });
});

describe('player foul state', () => {
  test.each([[0, 'ok'], [3, 'ok'], [4, 'warn'], [5, 'out'], [6, 'out']] as const)(
    '%i fouls -> %s', (n, state) => {
      const p = derive(fouls(game(), 1, n)).players[0];
      expect(p.fouls).toBe(n);
      expect(p.foulState).toBe(state);
    });

  test('2 technicals and nothing else is out', () => {
    const p = derive(add(game(), 1, { type: 'TECH', playerId: 'p1' }, { type: 'TECH', playerId: 'p1' })).players[0];
    expect(p).toMatchObject({ fouls: 2, techs: 2, foulState: 'out' });
  });

  test('1 technical is not out; techs count toward the 5-foul limit', () => {
    let g = add(game(), 1, { type: 'TECH', playerId: 'p1' });
    expect(derive(g).players[0].foulState).toBe('ok');
    g = fouls(g, 1, 3);
    expect(derive(g).players[0].foulState).toBe('warn');
    g = fouls(g, 1, 1);
    expect(derive(g).players[0].foulState).toBe('out');
  });

  test('entries after fouling out are accepted and counted', () => {
    const g = add(fouls(game(), 1, 5), 1, { type: 'FG2', playerId: 'p1' });
    const p = derive(g).players[0];
    expect(p.foulState).toBe('out');
    expect(p.points).toBe(2);
  });

  test('personal fouls accumulate across periods for player state but not for team bonus', () => {
    let g = fouls(game(), 1, 3);
    g = fouls(g, 2, 3);
    const d = derive(g);
    expect(d.players[0].foulState).toBe('out'); // 6 personal fouls across periods
    expect(d.teamFoulsForBonus(2)).toBe(3); // a cross-period sum would be 6
    expect(d.oppInBonus(2)).toBe(false);
  });
});

describe('timeouts', () => {
  test('totals: 3 full, 2 thirty, OT total tracks currentPeriod', () => {
    expect(derive(game()).timeouts).toEqual({
      full: { used: 0, total: 3 }, thirty: { used: 0, total: 2 }, ot: { used: 0, total: 0 },
    });
    expect(derive({ ...game(), currentPeriod: 4 }).timeouts.ot.total).toBe(0);
    expect(derive({ ...game(), currentPeriod: 5 }).timeouts.ot.total).toBe(1);
  });

  test('currentPeriod 6 gives ot.total 2; kinds are counted separately', () => {
    let g = { ...game(), currentPeriod: 6 };
    g = add(g, 1, { type: 'TIMEOUT', timeoutKind: 'full' }, { type: 'TIMEOUT', timeoutKind: 'thirty' });
    g = add(g, 6, { type: 'TIMEOUT', timeoutKind: 'ot' });
    expect(derive(g).timeouts).toEqual({
      full: { used: 1, total: 3 }, thirty: { used: 1, total: 2 }, ot: { used: 1, total: 2 },
    });
  });

  test('using 4 full timeouts is recorded, not blocked or thrown', () => {
    let g = game();
    for (let i = 0; i < 4; i++) g = add(g, 1 + i, { type: 'TIMEOUT', timeoutKind: 'full' });
    expect(derive(g).timeouts.full).toEqual({ used: 4, total: 3 });
  });

  test('timeouts and OPP_PTS do not score for us or add fouls', () => {
    const d = derive(add(game(), 1, { type: 'TIMEOUT', timeoutKind: 'full' }, { type: 'OPP_PTS', oppPoints: 3 }));
    expect(d.timeouts.full.used).toBe(1);
    expect(d.oppTotal).toBe(3);
    expect(d.usTotal).toBe(0);
    expect(d.usByPeriod).toEqual({});
    expect(d.teamFoulsByPeriod).toEqual({});
  });
});

describe('bonus carry-over at currentPeriod above 4', () => {
  test('fouls spread over Q3, Q4 and OT: neither "all fouls" nor "current period only" passes', () => {
    let g = fouls(game(), 3, 3);
    g = fouls(g, 4, 3);
    g = fouls(g, 5, 2);
    g = { ...g, currentPeriod: 5 };
    const d = derive(g);
    // all fouls = 8, current period only = 2, Q4 + OT1 = 5
    expect(d.teamFoulsForBonus(g.currentPeriod)).toBe(5);
    expect(d.oppInBonus(g.currentPeriod)).toBe(true);
  });
});
