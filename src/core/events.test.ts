import { describe, expect, test } from 'vitest';
import { periodLabel, isOvertime, otCount } from './periods';
import {
  appendEvent, deleteEvent, editEvent, insertEventBefore, moveFrom, newGame, orderedEvents,
} from './events';
import type { Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [{ id: 'p1', number: '1', name: 'Player One', pos: 'G' }];
const t0 = new Date('2026-11-10T10:00:00Z');
const t1 = new Date('2026-11-10T10:05:00Z');

function threeEvents(): Game {
  let g = newGame(info, roster, t0);
  for (let i = 0; i < 3; i++) g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0);
  return g;
}

function expectMonotonic(g: Game): void {
  const periods = orderedEvents(g).map((e) => e.period);
  expect(periods).toEqual([...periods].sort((a, b) => a - b));
}

describe('periods', () => {
  test('periodLabel', () => {
    expect([1, 4, 5, 6].map(periodLabel)).toEqual(['Q1', 'Q4', 'OT1', 'OT2']);
  });
  test('isOvertime and otCount', () => {
    expect([4, 5].map(isOvertime)).toEqual([false, true]);
    expect([1, 4, 5, 7].map(otCount)).toEqual([0, 0, 1, 3]);
  });
});

describe('event log', () => {
  test('newGame starts in Q1 with no events', () => {
    const g = newGame(info, roster, t0);
    expect(g.currentPeriod).toBe(1);
    expect(g.events).toEqual([]);
    expect(g.version).toBe(1);
    expect(g.trackOpponentTaps).toBe(false);
    expect(g.updatedAt).toBe(t0.toISOString());
  });

  test('appendEvent stamps currentPeriod and orders 0,1,2', () => {
    const g = threeEvents();
    expect(g.events.map((e) => e.order)).toEqual([0, 1, 2]);
    expect(g.events.every((e) => e.period === 1)).toBe(true);
    expect(new Set(g.events.map((e) => e.id)).size).toBe(3);
  });

  test('appendEvent stamps a non-default currentPeriod', () => {
    const g = { ...newGame(info, roster, t0), currentPeriod: 3 };
    const g2 = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0);
    expect(g2.events[0].period).toBe(3);
  });

  test('insertEventBefore and moveFrom throw on an unknown id', () => {
    const g = threeEvents();
    expect(() => insertEventBefore(g, 'nope', { type: 'FG2', playerId: 'p1' }, t1)).toThrow(/No event with id/);
    expect(() => moveFrom(g, 'nope', 2, t1)).toThrow(/No event with id/);
  });

  test('appendEvent honors an explicit period', () => {
    const g = appendEvent(newGame(info, roster, t0), { type: 'FOUL', playerId: 'p1', period: 3 }, t0);
    expect(g.events[0].period).toBe(3);
  });

  test('insertEventBefore lands between and takes the target period, not currentPeriod', () => {
    let g = threeEvents();
    g = { ...g, currentPeriod: 3 };
    const [a, b, c] = orderedEvents(g);
    const g2 = insertEventBefore(g, b.id, { type: 'FTM', playerId: 'p1' }, t1);
    const o = orderedEvents(g2);
    expect(o).toHaveLength(4);
    expect(o[0].id).toBe(a.id);
    expect(o[1].type).toBe('FTM');
    expect(o[1].period).toBe(b.period);
    expect(o[1].period).toBe(1);
    expect(o[2].id).toBe(b.id);
    expect(o[3].id).toBe(c.id);
  });

  test('insert before the first event places it first', () => {
    const g = threeEvents();
    const first = orderedEvents(g)[0];
    const g2 = insertEventBefore(g, first.id, { type: 'TECH', playerId: 'p1' }, t1);
    const o = orderedEvents(g2);
    expect(o[0].type).toBe('TECH');
    expect(o[0].order).toBe(first.order - 1);
    expect(o[1].id).toBe(first.id);
  });

  test('moveFrom shifts later events', () => {
    const g = threeEvents();
    const [A, B, C] = orderedEvents(g);
    const g2 = moveFrom(g, B.id, 2, t1);
    const p = Object.fromEntries(g2.events.map((e) => [e.id, e.period]));
    expect(p).toEqual({ [A.id]: 1, [B.id]: 2, [C.id]: 2 });
  });

  test('moveFrom skips later events in earlier periods and allows moving backward', () => {
    const g = threeEvents();
    const [A, B, C] = orderedEvents(g);
    const g3 = { ...g, events: g.events.map((e) => (e.id === C.id ? { ...e, period: 0 } : e)) };
    const g4 = moveFrom(g3, B.id, 3, t1);
    expect(g4.events.find((e) => e.id === C.id)!.period).toBe(0);
    expect(g4.events.find((e) => e.id === A.id)!.period).toBe(1);
    const g5 = moveFrom(moveFrom(g, B.id, 3, t1), B.id, 2, t1);
    expect(g5.events.find((e) => e.id === B.id)!.period).toBe(2);
  });

  test('moveFrom moves only later plays of the same period, forward and backward', () => {
    let g = newGame(info, roster, t0);
    for (const period of [1, 2, 3, 1]) g = appendEvent(g, { type: 'FG2', playerId: 'p1', period }, t0);
    // Hand-made legacy order: E4 is later by order than E2 and E3 but in E1's period.
    g = { ...g, events: g.events.map((e, i) => ({ ...e, order: i })) };
    const [E1, E2, E3, E4] = orderedEvents(g);
    const periods = (x: typeof g) => orderedEvents(x).map((e) => e.period);
    expect(periods(moveFrom(g, E1.id, 2, t1))).toEqual([2, 2, 3, 2]);
    expect(periods(moveFrom(g, E2.id, 1, t1))).toEqual([1, 1, 3, 1]);
    expect(periods(moveFrom(g, E3.id, 2, t1))).toEqual([1, 2, 2, 1]);
    expect(E4.period).toBe(1);
  });

  test('appendEvent with the current period still orders after everything (max + 1)', () => {
    let g = { ...threeEvents(), currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t1);
    expect(orderedEvents(g).map((e) => e.order)).toEqual([0, 1, 2, 3]);
  });

  test('a play added to an earlier quarter sorts with that quarter', () => {
    let g = threeEvents(); // Q1: 0, 1, 2
    g = { ...g, currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG3', playerId: 'p1' }, t0); // Q2
    g = appendEvent(g, { type: 'FTM', playerId: 'p1' }, t0); // Q2
    g = appendEvent(g, { type: 'FOUL', playerId: 'p1', period: 1 }, t1); // added to Q1 from Q2
    const o = orderedEvents(g);
    expect(o.map((e) => e.period)).toEqual([1, 1, 1, 1, 2, 2]);
    expect(o[3].type).toBe('FOUL');
    expectMonotonic(g);
  });

  test('a play added to a quarter before every existing play goes first', () => {
    let g = { ...newGame(info, roster, t0), currentPeriod: 3 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 2 }, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p1', period: 1 }, t1);
    expect(orderedEvents(g).map((e) => [e.period, e.type])).toEqual([[1, 'FG3'], [2, 'FG2']]);
  });

  test('adding to an empty middle quarter lands between its neighbors', () => {
    let g = { ...newGame(info, roster, t0), currentPeriod: 3 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t0);
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 3 }, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p1', period: 2 }, t1);
    expect(orderedEvents(g).map((e) => e.period)).toEqual([1, 2, 3]);
  });

  test('editing a play to an earlier period re-slots it at the end of that period', () => {
    let g = threeEvents();
    g = { ...g, currentPeriod: 3 };
    for (const period of [2, 2, 3]) g = appendEvent(g, { type: 'FG3', playerId: 'p1', period }, t0);
    const lastQ3 = orderedEvents(g)[5];
    const g2 = editEvent(g, lastQ3.id, { period: 1 }, t1);
    const o = orderedEvents(g2);
    expect(o.map((e) => e.period)).toEqual([1, 1, 1, 1, 2, 2]);
    expect(o[3].id).toBe(lastQ3.id);
    expectMonotonic(g2);
    // And forward: the first Q1 play moved to Q2 goes to the end of Q2.
    const firstQ1 = o[0];
    const g3 = editEvent(g2, firstQ1.id, { period: 2 }, t1);
    expect(orderedEvents(g3)[5].id).toBe(firstQ1.id);
    expectMonotonic(g3);
  });

  test('an edit that leaves the period alone keeps the order', () => {
    const g = threeEvents();
    const id = orderedEvents(g)[0].id;
    expect(editEvent(g, id, { period: 1, type: 'FG3' }, t1).events.find((e) => e.id === id)!.order).toBe(0);
  });

  test('moveFrom past a quarter that has plays lands at the start of the target and leaves the one between alone', () => {
    let g = { ...newGame(info, roster, t0), currentPeriod: 3 };
    for (const period of [1, 1, 1, 2, 3]) g = appendEvent(g, { type: 'FG2', playerId: 'p1', period }, t0);
    const [Q1a, Q1b, Q1c, Q2, Q3] = orderedEvents(g);
    const g2 = moveFrom(g, Q1b.id, 3, t1);
    const p = Object.fromEntries(g2.events.map((e) => [e.id, e.period]));
    expect(p).toEqual({ [Q1a.id]: 1, [Q1b.id]: 3, [Q1c.id]: 3, [Q2.id]: 2, [Q3.id]: 3 });
    expect(g2.events.find((e) => e.id === Q2.id)).toEqual(Q2);
    expect(orderedEvents(g2).map((e) => e.id)).toEqual([Q1a.id, Q2.id, Q1b.id, Q1c.id, Q3.id]);
    expectMonotonic(g2);
  });

  test('moveFrom past an empty quarter also lands at the start of the target', () => {
    let g = { ...newGame(info, roster, t0), currentPeriod: 3 };
    for (const period of [1, 1, 1, 3]) g = appendEvent(g, { type: 'FG2', playerId: 'p1', period }, t0);
    const [Q1a, Q1b, Q1c, Q3] = orderedEvents(g);
    const g2 = moveFrom(g, Q1b.id, 3, t1);
    expect(orderedEvents(g2).map((e) => [e.id, e.period])).toEqual([[Q1a.id, 1], [Q1b.id, 3], [Q1c.id, 3], [Q3.id, 3]]);
    expectMonotonic(g2);
  });

  test('moveFrom after a missed End Q keeps the order period-monotonic', () => {
    let g = threeEvents(); // Q1 x3; End Q1 was missed for the last two
    const [, B] = orderedEvents(g);
    g = { ...g, currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG3', playerId: 'p1' }, t0); // a real Q2 play after End Q1 (late)
    const g2 = moveFrom(g, B.id, 2, t1);
    expect(orderedEvents(g2).map((e) => e.period)).toEqual([1, 2, 2, 2]);
    expect(orderedEvents(g2).map((e) => e.order)).toEqual(orderedEvents(g).map((e) => e.order));
    expectMonotonic(g2);
  });

  test('moveFrom backward from mid-period re-slots the moved plays at the end of the target', () => {
    let g = { ...newGame(info, roster, t0), currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t0);
    for (let i = 0; i < 3; i++) g = appendEvent(g, { type: 'FG3', playerId: 'p1', period: 2 }, t0);
    const [, , Q2b, Q2c] = orderedEvents(g);
    const g2 = moveFrom(g, Q2b.id, 1, t1);
    const o = orderedEvents(g2);
    expect(o.map((e) => e.period)).toEqual([1, 1, 1, 2]);
    expect([o[1].id, o[2].id]).toEqual([Q2b.id, Q2c.id]);
    expectMonotonic(g2);
  });

  test('editEvent changes type and sets editedAt', () => {
    const g = threeEvents();
    const id = g.events[1].id;
    const g2 = editEvent(g, id, { type: 'FG3' }, t1);
    const e = g2.events.find((x) => x.id === id)!;
    expect(e.type).toBe('FG3');
    expect(e.editedAt).toBe(t1.toISOString());
    expect(g2.events.find((x) => x.id === g.events[0].id)!.editedAt).toBeUndefined();
  });

  test('deleteEvent removes the event', () => {
    const g = threeEvents();
    const id = g.events[1].id;
    const g2 = deleteEvent(g, id, t1);
    expect(g2.events.map((e) => e.id)).not.toContain(id);
    expect(g2.events).toHaveLength(2);
  });

  test('every op bumps updatedAt and does not mutate its input', () => {
    const g = threeEvents();
    const frozen = Object.freeze({
      ...g,
      events: Object.freeze(g.events.map((e) => Object.freeze({ ...e }))) as Game['events'],
    }) as Game;
    const id = frozen.events[1].id;
    const results = [
      appendEvent(frozen, { type: 'FTX', playerId: 'p1' }, t1),
      insertEventBefore(frozen, id, { type: 'FTM', playerId: 'p1' }, t1),
      editEvent(frozen, id, { type: 'FG3' }, t1),
      deleteEvent(frozen, id, t1),
      moveFrom(frozen, id, 2, t1),
    ];
    for (const r of results) expect(r.updatedAt).toBe(t1.toISOString());
    expect(frozen.updatedAt).toBe(t0.toISOString());
    expect(frozen.events).toHaveLength(3);
  });
});
