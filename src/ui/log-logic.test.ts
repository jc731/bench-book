import { describe, expect, it } from 'vitest';
import { appendEvent, moveFrom, newGame } from '../core/events';
import type { EventDraft, Game, GameEvent } from '../core/types';
import {
  compatibleTypes, draftOf, editLabel, editPatch, eventRowText, groupByPeriod, insertLabel,
  moveFromCount, moveFromLabel, moveFromTargets, playsCount,
} from './log-logic';

const info = { team: 'T', opponent: 'O', date: '2026-11-10', homeAway: 'home' as const, coach: '', scorer: '', timer: '' };
const roster = [
  { id: 'a', number: '4', name: 'Player One', pos: '' },
  { id: 'b', number: '7', name: '', pos: '' },
];
const NOW = new Date('2026-11-10T12:00:00Z');

function game(drafts: EventDraft[], currentPeriod = 3): Game {
  let g = { ...newGame(info, roster, NOW), currentPeriod };
  for (const d of drafts) g = appendEvent(g, d, NOW);
  return g;
}
const first = (g: Game): GameEvent => g.events[0];

describe('eventRowText', () => {
  const g = game([
    { type: 'FG2', playerId: 'a' },
    { type: 'FOUL', playerId: 'b' },
    { type: 'OPP_PTS', oppPoints: 3 },
    { type: 'TIMEOUT', timeoutKind: 'full' },
    { type: 'BENCH_TECH' },
    { type: 'FTX', playerId: 'zz' },
  ]);
  it('reads number, name, then the play', () => {
    expect(eventRowText(g, g.events[0])).toBe('#4 Player One · +2');
  });
  it('drops the name when blank and tolerates an unknown player', () => {
    expect(eventRowText(g, g.events[1])).toBe('#7 · Foul');
    expect(eventRowText(g, g.events[5])).toBe('#? · FT ✗');
  });
  it('writes non-player events without a player', () => {
    expect(eventRowText(g, g.events[2])).toBe('Opp +3');
    expect(eventRowText(g, g.events[3])).toBe('Timeout (Full)');
    expect(eventRowText(g, g.events[4])).toBe('Bench T');
  });
});

describe('groupByPeriod', () => {
  const g = game([
    { type: 'FG2', playerId: 'a', period: 1 },
    { type: 'FG3', playerId: 'a', period: 2 },
    { type: 'FOUL', playerId: 'b', period: 1 },
  ]);
  it('lists the newest period first and events in order within a period', () => {
    const groups = groupByPeriod(g);
    expect(groups.map((x) => x.period)).toEqual([2, 1]);
    expect(groups[1].events.map((e) => e.type)).toEqual(['FG2', 'FOUL']);
  });
  it('sorts by order, not array position', () => {
    const swapped = { ...g, events: [...g.events].reverse() };
    expect(groupByPeriod(swapped)[1].events.map((e) => e.type)).toEqual(['FG2', 'FOUL']);
  });
  it('filters to one period and gives nothing for an empty one', () => {
    expect(groupByPeriod(g, 1)).toHaveLength(1);
    expect(groupByPeriod(g, 1)[0].events).toHaveLength(2);
    expect(groupByPeriod(g, 3)).toEqual([]);
  });
});

describe('editing', () => {
  const g = game([
    { type: 'FG2', playerId: 'a' },
    { type: 'TIMEOUT', timeoutKind: 'full' },
    { type: 'OPP_PTS', oppPoints: 2 },
    { type: 'BENCH_TECH' },
  ]);
  it('offers only compatible types', () => {
    expect(compatibleTypes(g.events[0])).toEqual(['FG2', 'FG3', 'FTM', 'FTX', 'FOUL', 'TECH']);
    expect(compatibleTypes(g.events[1])).toEqual(['TIMEOUT']);
    expect(compatibleTypes(g.events[2])).toEqual(['OPP_PTS']);
    expect(compatibleTypes(g.events[3])).toEqual(['BENCH_TECH']);
  });
  it('patches only what changed', () => {
    const e = first(g);
    expect(editPatch(e, { ...draftOf(e), type: 'FG3' })).toEqual({ type: 'FG3' });
    expect(editPatch(e, { ...draftOf(e), playerId: 'b', period: 2 })).toEqual({ playerId: 'b', period: 2 });
    expect(editPatch(e, draftOf(e))).toEqual({});
  });
  it('clears fields the final type does not use', () => {
    const stale: GameEvent = { ...first(g), oppPoints: 2, timeoutKind: 'full' };
    const p = editPatch(stale, draftOf(stale));
    expect('oppPoints' in p && p.oppPoints === undefined).toBe(true);
    expect('timeoutKind' in p && p.timeoutKind === undefined).toBe(true);
    const bench: GameEvent = { ...g.events[3], playerId: 'a' };
    const bp = editPatch(bench, draftOf({ ...bench, playerId: undefined }));
    expect('playerId' in bp && bp.playerId === undefined).toBe(true);
    const t = g.events[1];
    expect(editPatch(t, { ...draftOf(t), timeoutKind: 'thirty' })).toEqual({ timeoutKind: 'thirty' });
    const o = g.events[2];
    expect(editPatch(o, { ...draftOf(o), oppPoints: 3 })).toEqual({ oppPoints: 3 });
  });
  it('labels edits for the toast', () => {
    const e = first(g);
    expect(editLabel(g, e, { type: 'FG3' })).toBe('Edited #4 +2 → +3');
    expect(editLabel(g, e, { playerId: 'b' })).toBe('Edited #4 +2 → #7 +2');
    expect(editLabel(g, e, { period: 2 })).toBe('Moved #4 +2 to Q2');
    expect(editLabel(g, e, { type: 'FOUL', period: 2 })).toBe('Edited #4 +2 → Foul, now in Q2');
    expect(editLabel(g, g.events[2], { oppPoints: 3 })).toBe('Edited Opp +2 → Opp +3');
  });
  it('labels an insert with the period', () => {
    expect(insertLabel('FOUL', '4', 1)).toBe('Inserted #4 Foul in Q1');
  });
});

describe('moving', () => {
  const g = game(
    [
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 2 },
      { type: 'FG2', playerId: 'a', period: 1 }, // later by order, but an earlier period
    ],
    3,
  );
  it('offers the periods either side, bounded', () => {
    expect(moveFromTargets(g, g.events[0])).toEqual([2]);
    expect(moveFromTargets(g, g.events[3])).toEqual([1, 3]);
    expect(moveFromTargets({ ...g, currentPeriod: 2 }, g.events[3])).toEqual([1]);
  });
  it('counts what moveFrom touches', () => {
    expect(moveFromCount(g, g.events[1].id)).toBe(3); // itself, the next Q1 play, and the late Q1 play; the Q2 play stays
    expect(moveFromCount(g, g.events[3].id)).toBe(1); // the later Q1 play is an earlier period, so it stays
    expect(moveFromCount(g, 'nope')).toBe(0);
  });
  it('matches the number of plays whose period actually changes', () => {
    for (const e of g.events) {
      const target = e.period === 1 ? 2 : 1;
      const moved = moveFrom(g, e.id, target, NOW);
      const changed = moved.events.filter((m, i) => m.period !== g.events[i].period).length;
      expect(moveFromCount(g, e.id)).toBe(changed);
    }
  });
  it('words the count', () => {
    expect(playsCount(1)).toBe('1 play');
    expect(playsCount(3)).toBe('3 plays');
    expect(moveFromLabel(5, 2)).toBe('Moved 5 plays to Q2');
    expect(moveFromLabel(1, 6)).toBe('Moved 1 play to OT2');
  });
});
