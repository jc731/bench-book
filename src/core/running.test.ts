import { describe, expect, test } from 'vitest';
import { appendEvent, newGame } from './events';
import { runningScore } from './running';
import type { Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [
  { id: 'p4', number: '4', name: 'Player Four', pos: 'G' },
  { id: 'p00', number: '00', name: 'Player Zero', pos: 'F' },
];
const t0 = new Date('2026-11-10T10:00:00Z');

describe('runningScore', () => {
  test('cumulative score, mark glyph and jersey number per scoring event', () => {
    let g: Game = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'FTM', playerId: 'p00' }, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p4' }, t0);
    const m = runningScore(g);
    expect(m.map((x) => x.score)).toEqual([2, 3, 6]);
    expect(m.map((x) => x.mark)).toEqual(['X', '/', '●']);
    expect(m.map((x) => x.number)).toEqual(['4', '00', '4']);
  });

  test('FTX, fouls, timeouts and opponent taps produce no mark and add nothing', () => {
    let g: Game = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'FTX', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'FOUL', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'TIMEOUT', timeoutKind: 'full' }, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3 }, t0);
    g = appendEvent(g, { type: 'FTM', playerId: 'p00' }, t0);
    const m = runningScore(g);
    expect(m.map((x) => x.score)).toEqual([2, 3]);
    expect(m.map((x) => x.mark)).toEqual(['X', '/']);
  });

  test('endsPeriod is true only on the last mark of each period, and period is carried', () => {
    let g: Game = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p4' }, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p4', period: 2 }, t0);
    g = appendEvent(g, { type: 'FTM', playerId: 'p00', period: 2 }, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p00', period: 3 }, t0);
    const m = runningScore(g);
    expect(m.map((x) => x.period)).toEqual([1, 1, 2, 2, 3]);
    expect(m.map((x) => x.endsPeriod)).toEqual([false, true, false, true, true]);
  });

  test('a play added to Q1 while in Q2 ends Q1, not Q2', () => {
    let g: Game = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p4' }, t0);
    g = { ...g, currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG3', playerId: 'p00' }, t0);
    g = appendEvent(g, { type: 'FTM', playerId: 'p00', period: 1 }, t0); // "Add play to Q1"
    const m = runningScore(g);
    expect(m.map((x) => [x.period, x.score, x.endsPeriod])).toEqual([
      [1, 2, false], [1, 3, true], [2, 6, true],
    ]);
  });

  test('empty game has no marks', () => {
    expect(runningScore(newGame(info, roster, t0))).toEqual([]);
  });

  test('marks follow event order, not insertion order', () => {
    let g: Game = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p4' }, t0);
    g = { ...g, events: g.events.map((e) => ({ ...e, order: 5 })) };
    g = appendEvent(g, { type: 'FTM', playerId: 'p00' }, t0); // order 6
    g = { ...g, events: [g.events[1], g.events[0]] }; // array order reversed
    expect(runningScore(g).map((x) => x.score)).toEqual([3, 4]);
  });
});
