import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { addPlayer, appendEvent, editEvent, moveFrom, newGame, orderedEvents, recordSub } from './events';
import { isPromotingPlay, lineup, suggestFrom } from './lineup';
import type { EventDraft, Game, GameEvent, GameInfo, Player, Side, Sub } from './types';

const info: GameInfo = {
  team: 'Maple Hill', opponent: 'Cedar Run', date: '2026-11-17', homeAway: 'home',
  coach: 'Coach Pell', scorer: 'Scorer Ames', timer: 'Timer Rudd',
};
const nums = ['4', '5', '7', '10', '12', '22', '31'];
const names = ['Ada Quill', 'Bea Fenn', 'Cora Lusk', 'Dot Merrow', 'Eve Strand', 'Fay Tolliver', 'Gia Wren'];
const home: Player[] = nums.map((n, i) => ({ id: `h${n}`, number: n, name: names[i], pos: '' }));
const now = new Date('2026-11-17T10:00:00Z');

function game(roster: Player[] = home): Game {
  return newGame(info, roster, now);
}
function add(g: Game, ...drafts: EventDraft[]): Game {
  return drafts.reduce((acc, d) => appendEvent(acc, { period: 1, ...d }, now), g);
}
function lastOrder(g: Game): number {
  const all = [...g.events.map((e) => e.order), ...(g.subs ?? []).map((s) => s.order)];
  return all.length ? Math.max(...all) : -1;
}
let subN = 0;
function sub(g: Game, ins: string[], outs: string[], side: Side = 'us', order = lastOrder(g) + 1): Game {
  const s: Sub = { id: `s${subN++}`, side, ins, outs, order, period: 1, enteredAt: now.toISOString() };
  return { ...g, subs: [...(g.subs ?? []), s] };
}
const STARTERS = ['h4', 'h5', 'h7', 'h10', 'h12'];

describe('starters', () => {
  test('the first five are the floor; the rest are the bench; nothing played yet', () => {
    const l = lineup(game(), 'us');
    expect(l.floor).toEqual(STARTERS);
    expect(l.bench).toEqual(['h22', 'h31']);
    expect(l.layout).toEqual(home.map((p) => p.id));
    expect(l.tracked).toBe(true);
    expect(l.playedYet).toBe(false);
    expect(l.changedUnseen).toBe(false);
    expect(l.justIn).toBeNull();
    expect(l.outIds).toEqual([]);
  });

  test('a game saved before 0.9 (no subs field) replays from the first five and its plays', () => {
    const g = add(game(), { type: 'FG2', playerId: 'h31' });
    expect('subs' in g).toBe(false);
    expect(lineup(g, 'us').floor).toEqual([...STARTERS, 'h31']);
  });
});

describe('promotion', () => {
  test('a bench FG2 puts her on the floor without moving her card; amber until the next play', () => {
    // #31, the last bench card: a regrouped layout would put her ahead of #22.
    const g = add(game(), { type: 'FG2', playerId: 'h31' });
    const l = lineup(g, 'us');
    expect(l.floor).toEqual([...STARTERS, 'h31']);
    expect(l.bench).toEqual(['h22']);
    expect(l.justIn).toBe('h31');
    expect(l.layout).toEqual(home.map((p) => p.id));
    expect(l.playedYet).toBe(true);
    expect(l.changedUnseen).toBe(true);

    const after = lineup(add(g, { type: 'FG3', playerId: 'h4' }), 'us');
    expect(after.changedUnseen).toBe(false);
    expect(after.floor).toHaveLength(6);
  });

  test("the other team's play does not clear this team's amber", () => {
    const g = add(game(), { type: 'FG2', playerId: 'h22' }, { type: 'OPP_PTS', oppPoints: 2 });
    expect(lineup(g, 'us').changedUnseen).toBe(true);
    const g2 = add(game(), { type: 'FG2', playerId: 'h22' }, { type: 'TIMEOUT', timeoutKind: 'full', side: 'them' });
    expect(lineup(g2, 'us').changedUnseen).toBe(true);
  });

  test("a timeout or bench tech is not that team's play: Starters stays and amber stays", () => {
    const to = add(game(), { type: 'TIMEOUT', timeoutKind: 'full' });
    expect(lineup(to, 'us').playedYet).toBe(false);
    expect(lineup(add(game(), { type: 'BENCH_TECH' }), 'us').playedYet).toBe(false);
    const promoted = add(game(), { type: 'FG2', playerId: 'h22' });
    expect(lineup(add(promoted, { type: 'TIMEOUT', timeoutKind: 'full' }), 'us').changedUnseen).toBe(true);
    expect(lineup(add(promoted, { type: 'BENCH_TECH' }), 'us').changedUnseen).toBe(true);
    // A real play still counts for both.
    expect(lineup(add(promoted, { type: 'FTX', playerId: 'h4' }), 'us').changedUnseen).toBe(false);
  });

  test('every promoting type promotes: FG3, FTM, FTX, FOUL', () => {
    for (const type of ['FG3', 'FTM', 'FTX', 'FOUL'] as const) {
      expect(lineup(add(game(), { type, playerId: 'h31' }), 'us').floor).toContain('h31');
    }
  });

  test('a free-throw pair (FTX then FTM) promotes once', () => {
    const g = add(game(), { type: 'FTX', playerId: 'h22' }, { type: 'FTM', playerId: 'h22' });
    const l = lineup(g, 'us');
    expect(l.floor).toEqual([...STARTERS, 'h22']);
    expect(l.justIn).toBe('h22');
    // The second free throw did not change the count, so the amber is gone.
    expect(l.changedUnseen).toBe(false);
  });
});

describe('no promotion', () => {
  test('a TECH on a bench player leaves her on the bench', () => {
    const l = lineup(add(game(), { type: 'TECH', playerId: 'h22' }), 'us');
    expect(l.floor).toEqual(STARTERS);
    expect(l.justIn).toBeNull();
    expect(l.changedUnseen).toBe(false);
  });

  test('a play entered for an out player does not bring her back', () => {
    let g = add(game(), { type: 'TECH', playerId: 'h22' }, { type: 'TECH', playerId: 'h22' });
    g = add(g, { type: 'FG2', playerId: 'h22' });
    const l = lineup(g, 'us');
    expect(l.outIds).toEqual(['h22']);
    expect(l.floor).toEqual(STARTERS);
  });

  test('a play with no number promotes nobody', () => {
    const l = lineup(add(game(), { type: 'FG2' }), 'us');
    expect(l.floor).toEqual(STARTERS);
    expect(l.playedYet).toBe(true);
  });

  test('isPromotingPlay: types, player and the out flag', () => {
    const e = (type: GameEvent['type'], playerId?: string): GameEvent =>
      ({ id: 'x', order: 0, period: 1, type, playerId, enteredAt: now.toISOString() });
    for (const t of ['FG2', 'FG3', 'FTM', 'FTX', 'FOUL'] as const) expect(isPromotingPlay(e(t, 'h22'), false)).toBe(true);
    expect(isPromotingPlay(e('FG2', 'h22'), true)).toBe(false);
    expect(isPromotingPlay(e('TECH', 'h22'), false)).toBe(false);
    expect(isPromotingPlay(e('FG2'), false)).toBe(false);
    expect(isPromotingPlay(e('BENCH_TECH'), false)).toBe(false);
  });
});

describe('foul-out', () => {
  test("#10's fifth foul takes her off the floor", () => {
    let g = game();
    for (let i = 0; i < 4; i++) g = add(g, { type: 'FOUL', playerId: 'h10' });
    expect(lineup(g, 'us').floor).toContain('h10');
    g = add(g, { type: 'FOUL', playerId: 'h10' });
    const l = lineup(g, 'us');
    expect(l.floor).toEqual(['h4', 'h5', 'h7', 'h12']);
    expect(l.outIds).toEqual(['h10']);
    expect(l.bench).toEqual(['h10', 'h22', 'h31']);
    expect(l.changedUnseen).toBe(true);
    // Her card turns out in place: no regroup until a sub.
    expect(l.layout).toEqual(home.map((p) => p.id));
  });

  test('a promoting foul that is also her fifth clears justIn', () => {
    // #31 picks up four fouls (the first brings her on), is subbed off, then a fifth from the bench.
    let g = game();
    for (let i = 0; i < 4; i++) g = add(g, { type: 'FOUL', playerId: 'h31' });
    g = sub(g, [], ['h31']);
    g = add(g, { type: 'FOUL', playerId: 'h31' });
    const l = lineup(g, 'us');
    expect(l.outIds).toEqual(['h31']);
    expect(l.floor).toEqual(STARTERS);
    expect(l.justIn).toBeNull();
  });

  test('justIn clears when the promoted player later fouls out', () => {
    let g = add(game(), { type: 'FG2', playerId: 'h22' });
    for (let i = 0; i < 4; i++) g = add(g, { type: 'FOUL', playerId: 'h22' });
    expect(lineup(g, 'us').justIn).toBe('h22');
    g = add(g, { type: 'FOUL', playerId: 'h22' });
    expect(lineup(g, 'us').justIn).toBeNull();
  });

  test('a TECH counts as a foul toward five; two techs is out', () => {
    let g = game();
    for (let i = 0; i < 4; i++) g = add(g, { type: 'FOUL', playerId: 'h4' });
    g = add(g, { type: 'TECH', playerId: 'h4' }, { type: 'TECH', playerId: 'h5' }, { type: 'TECH', playerId: 'h5' });
    expect(lineup(g, 'us').outIds).toEqual(['h4', 'h5']);
  });

  test('outIds agree with derive() on the same game, for both teams', () => {
    const opp: Player[] = home.map((p) => ({ ...p, id: `a${p.number}`, name: `Away ${p.name}` }));
    let g = newGame(info, home, now, opp);
    for (let i = 0; i < 5; i++) g = add(g, { type: 'FOUL', playerId: 'h22' }, { type: 'FOUL', playerId: 'a7', side: 'them' });
    g = add(g, { type: 'TECH', playerId: 'h4' }, { type: 'TECH', playerId: 'h4' }, { type: 'TECH', playerId: 'a31', side: 'them' });
    const d = derive(g);
    const outOf = (players: { playerId: string; foulState: string }[]) =>
      players.filter((p) => p.foulState === 'out').map((p) => p.playerId);
    expect(lineup(g, 'us').outIds.sort()).toEqual(outOf(d.us.players).sort());
    expect(lineup(g, 'them').outIds.sort()).toEqual(outOf(d.opp.players).sort());
    expect(lineup(g, 'us').outIds.length).toBe(2);
  });
});

describe('subs', () => {
  test('{ins:[#22], outs:[#10]} swaps them and regroups the layout floor-first', () => {
    const g = sub(game(), ['h22'], ['h10']);
    const l = lineup(g, 'us');
    expect(l.floor).toEqual(['h4', 'h5', 'h7', 'h12', 'h22']);
    expect(l.bench).toEqual(['h10', 'h31']);
    expect(l.layout).toEqual(['h4', 'h5', 'h7', 'h12', 'h22', 'h10', 'h31']);
    expect(l.changedUnseen).toBe(false);
  });

  test('a sub clears an amber set by a promotion', () => {
    const g = add(game(), { type: 'FG2', playerId: 'h22' });
    expect(lineup(g, 'us').changedUnseen).toBe(true);
    expect(lineup(sub(g, [], ['h4']), 'us').changedUnseen).toBe(false);
  });

  test('a sub clears justIn and freezes the layout until the next sub', () => {
    let g = add(game(), { type: 'FG2', playerId: 'h31' });
    g = sub(g, [], ['h4']);
    let l = lineup(g, 'us');
    expect(l.justIn).toBeNull();
    expect(l.layout).toEqual(['h5', 'h7', 'h10', 'h12', 'h31', 'h4', 'h22']);
    g = add(g, { type: 'FG2', playerId: 'h4' });
    l = lineup(g, 'us');
    expect(l.floor).toEqual(['h5', 'h7', 'h10', 'h12', 'h31', 'h4']);
    expect(l.layout).toEqual(['h5', 'h7', 'h10', 'h12', 'h31', 'h4', 'h22']);
    expect(l.justIn).toBe('h4');
  });

  test('a sub whose out is already off and whose in is already on changes nothing', () => {
    const l = lineup(sub(game(), ['h4'], ['h22']), 'us');
    expect(l.floor).toEqual(STARTERS);
    expect(l.bench).toEqual(['h22', 'h31']);
  });

  test('a sub skips ids not on the roster and players already out', () => {
    let g = add(game(), { type: 'TECH', playerId: 'h31' }, { type: 'TECH', playerId: 'h31' });
    g = sub(g, ['h31', 'ghost'], ['h4']);
    const l = lineup(g, 'us');
    expect(l.floor).toEqual(['h5', 'h7', 'h10', 'h12']);
    expect(l.layout).toEqual(['h5', 'h7', 'h10', 'h12', 'h4', 'h22', 'h31']);
  });

  test("a sub on one side does not touch the other side's floor", () => {
    const opp: Player[] = home.map((p) => ({ ...p, id: `a${p.number}` }));
    const g = sub(newGame(info, home, now, opp), ['a22'], ['a4'], 'them');
    expect(lineup(g, 'us').floor).toEqual(STARTERS);
    expect(lineup(g, 'them').floor).toEqual(['a5', 'a7', 'a10', 'a12', 'a22']);
  });

  test('on a tie in order, the sub comes before the play', () => {
    // The play at order 0 is by #4; a sub at the same order takes #4 off first, so her play puts her back.
    const g = sub(add(game(), { type: 'FG2', playerId: 'h4' }), [], ['h4'], 'us', 0);
    expect(lineup(g, 'us').floor).toEqual(['h5', 'h7', 'h10', 'h12', 'h4']);
  });

  test('Review Focus 1: a corrected play no longer promotes, and the later sub still applies', () => {
    let g = add(game(), { type: 'FG2', playerId: 'h22' });
    g = sub(g, [], ['h4']);
    const fg2 = orderedEvents(g)[0];
    g = editEvent(g, fg2.id, { playerId: 'h31' }, now);
    const l = lineup(g, 'us');
    expect(l.floor.slice().sort()).toEqual(['h10', 'h12', 'h31', 'h5', 'h7']);
    expect(l.floor).not.toContain('h22');
  });
});

describe('small rosters', () => {
  test('five or fewer: not tracked, everyone on the floor', () => {
    const l = lineup(game(home.slice(0, 4)), 'us');
    expect(l.tracked).toBe(false);
    expect(l.floor).toEqual(['h4', 'h5', 'h7', 'h10']);
    expect(l.bench).toEqual([]);
    expect(lineup(game(home.slice(0, 5)), 'us').tracked).toBe(false);
    expect(lineup(game(home.slice(0, 6)), 'us').tracked).toBe(true);
  });

  test('an empty roster gives empty lists', () => {
    const l = lineup(game([]), 'us');
    expect(l).toMatchObject({ floor: [], bench: [], layout: [], outIds: [], justIn: null, suggestion: null, tracked: false });
  });

  test('growth past five: the first five are floor, the sixth is bench until she plays', () => {
    let g = game(home.slice(0, 3));
    g = add(g, { type: 'FG2', playerId: 'h4' });
    for (const p of home.slice(3, 6)) g = addPlayer(g, 'us', p, now);
    let l = lineup(g, 'us');
    expect(l.floor).toEqual(STARTERS);
    expect(l.bench).toEqual(['h22']);
    expect(l.tracked).toBe(true);
    g = add(g, { type: 'FG2', playerId: 'h22' });
    l = lineup(g, 'us');
    expect(l.floor).toEqual([...STARTERS, 'h22']);
    expect(l.changedUnseen).toBe(true);
  });
});

describe('suggestion', () => {
  test('the floor player longest since her last play', () => {
    // Everyone on the floor plays except #7, who never does; #22 comes in.
    const g = add(game(),
      { type: 'FG2', playerId: 'h4' }, { type: 'FG2', playerId: 'h5' }, { type: 'FG2', playerId: 'h10' },
      { type: 'FG2', playerId: 'h12' }, { type: 'FG2', playerId: 'h22' });
    expect(lineup(g, 'us').suggestion).toBe('h7');
    // Once #7 plays, the least recent is #4.
    expect(lineup(add(g, { type: 'FOUL', playerId: 'h7' }), 'us').suggestion).toBe('h4');
  });

  test('ties go to the earliest in layout', () => {
    expect(lineup(add(game(), { type: 'FG2', playerId: 'h22' }), 'us').suggestion).toBe('h4');
    // After a sub regroups the layout, the earliest card is the first on the floor.
    const g = add(sub(game(), ['h31'], ['h4']), { type: 'FG2', playerId: 'h22' });
    expect(lineup(g, 'us').suggestion).toBe('h5');
  });

  test('a tech counts as a play for recency', () => {
    const g = add(game(), { type: 'TECH', playerId: 'h4' }, { type: 'FG2', playerId: 'h22' });
    expect(lineup(g, 'us').suggestion).toBe('h5');
  });

  test('suggestFrom: an out player first, else the longest since her last play, ties by layout', () => {
    const layout = ['a', 'b', 'c', 'd'];
    expect(suggestFrom(['b', 'c', 'd'], ['d'], new Map([['b', 1]]), layout)).toBe('d');
    expect(suggestFrom(['b', 'c', 'd'], [], new Map([['b', 3], ['c', 1], ['d', 2]]), layout)).toBe('c');
    expect(suggestFrom(['d', 'c'], [], new Map(), layout)).toBe('c');
    expect(suggestFrom([], [], new Map(), layout)).toBeNull();
  });
});

describe('recorded subs', () => {
  test('a play appended after recordSub comes after the sub: the sub-in player is not a bench promotion', () => {
    let g = recordSub(game(), 'us', ['h22'], ['h4'], now);
    g = appendEvent(g, { type: 'FG2', playerId: 'h22', period: 1 }, now);
    expect(g.events.at(-1)!.order).toBeGreaterThan(g.subs![0].order);
    const l = lineup(g, 'us');
    expect(l.floor).toEqual(['h5', 'h7', 'h10', 'h12', 'h22']);
    expect(l.bench).toEqual(['h4', 'h31']);
    expect(l.floor.filter((id) => id === 'h22')).toHaveLength(1);
  });
});

describe('layoutFloor: how many of the layout were on the floor at the last regroup', () => {
  test('five before any sub, or the whole roster when it has fewer', () => {
    expect(lineup(game(), 'us').layoutFloor).toBe(5);
    expect(lineup(game(home.slice(0, 3)), 'us').layoutFloor).toBe(3);
  });
  test('a promotion does not change it: the layout is frozen until a sub', () => {
    expect(lineup(add(game(), { type: 'FG2', playerId: 'h22' }), 'us').layoutFloor).toBe(5);
  });
  test('the floor size at the last sub, whether 6 or 4', () => {
    const six = sub(game(), ['h22'], []);
    expect(lineup(six, 'us').layoutFloor).toBe(6);
    expect(lineup(six, 'us').layout.slice(0, 6)).toEqual([...STARTERS, 'h22']);
    const four = sub(game(), [], ['h4']);
    expect(lineup(four, 'us').layoutFloor).toBe(4);
    expect(lineup(four, 'us').layout.slice(0, 4)).toEqual(['h5', 'h7', 'h10', 'h12']);
  });
  test('a foul-out after the sub leaves it as the sub set it', () => {
    let g = sub(game(), ['h22'], []);
    for (let i = 0; i < 5; i++) g = add(g, { type: 'FOUL', playerId: 'h4' });
    const l = lineup(g, 'us');
    expect(l.floor).toHaveLength(5);
    expect(l.layoutFloor).toBe(6);
  });
});

describe('moving a block of plays', () => {
  test('the floor after moving a block with a sub in it equals the floor before', () => {
    let g: Game = { ...game(), currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG2', playerId: 'h4', period: 1 }, now);
    g = appendEvent(g, { type: 'FG2', playerId: 'h5' }, now); // stays in Q2
    g = appendEvent(g, { type: 'FG2', playerId: 'h22' }, now); // h22 comes on
    g = recordSub(g, 'us', [], ['h22'], now); // and goes off
    g = appendEvent(g, { type: 'FG2', playerId: 'h22' }, now); // and comes back
    const before = lineup(g, 'us').floor;
    expect(before).toEqual([...STARTERS, 'h22']);
    const moved = moveFrom(g, orderedEvents(g)[2].id, 1, now);
    expect(lineup(moved, 'us').floor).toEqual(before);
  });
});
