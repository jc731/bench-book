import { describe, expect, test } from 'vitest';
import { appendEvent, deleteEvent, insertEventBefore, newGame, orderedEvents } from './events';
import {
  checkPeriod, endGame, endPeriod, markExported, openIssues, oppTotal, saveReconcile, startOvertime,
} from './reconcile';
import type { Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [{ id: 'p1', number: '1', name: 'Player One', pos: 'G' }];
const t0 = new Date('2026-11-10T10:00:00Z');
const t1 = new Date('2026-11-10T10:30:00Z');

// App at 10 in Q1: five FG2.
function tenInQ1(): Game {
  let g = newGame(info, roster, t0);
  for (let i = 0; i < 5; i++) g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0);
  return g;
}

describe('checkPeriod', () => {
  test('book 12 vs app 10 is a diff of 2 and unresolved; a note makes it noted', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, '', t1);
    const c = checkPeriod(g, 1);
    expect(c).toMatchObject({ period: 1, appUs: 10, bookUs: 12, diff: 2, status: 'unresolved', note: '' });
    g = saveReconcile(g, 1, 12, null, 'ref changed it', t1);
    expect(checkPeriod(g, 1)).toMatchObject({ status: 'noted', note: 'ref changed it', diff: 2 });
  });

  test('diff is bookUs - appUs, negative when the app is ahead', () => {
    const g = saveReconcile(tenInQ1(), 1, 8, null, '', t1);
    expect(checkPeriod(g, 1).diff).toBe(-2);
  });

  test('a whitespace-only note is not a note', () => {
    const g = saveReconcile(tenInQ1(), 1, 12, null, '   ', t1);
    expect(checkPeriod(g, 1).status).toBe('unresolved');
  });

  test('re-derives: matched, then unresolved after an insert, then matched after delete', () => {
    let g = endPeriod(saveReconcile(tenInQ1(), 1, 10, null, '', t1), t1);
    expect(checkPeriod(g, 1).status).toBe('matched');
    const first = orderedEvents(g)[0];
    g = insertEventBefore(g, first.id, { type: 'FG2', playerId: 'p1' }, t1);
    const c = checkPeriod(g, 1);
    expect(c).toMatchObject({ appUs: 12, bookUs: 10, diff: -2, status: 'unresolved' });
    const added = g.events.find((e) => e.id !== first.id && e.order < first.order)!;
    g = deleteEvent(g, added.id, t1);
    expect(checkPeriod(g, 1)).toMatchObject({ appUs: 10, status: 'matched' });
  });

  test('fixed: book 12 vs app 10 unresolved; adding the missing FG2 makes it fixed', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, '', t1);
    expect(checkPeriod(g, 1).status).toBe('unresolved');
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t1);
    expect(checkPeriod(g, 1)).toMatchObject({ appUs: 12, diff: 0, status: 'fixed' });
  });

  test('a note on a period that then matches is still fixed, not noted', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, 'check later', t1);
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t1);
    expect(checkPeriod(g, 1).status).toBe('fixed');
  });

  test('matched on first save never sets hadMismatch', () => {
    const g = saveReconcile(tenInQ1(), 1, 10, null, '', t1);
    expect(g.periods[0].hadMismatch).toBe(false);
  });

  test('no record is pending with null book and null diff', () => {
    expect(checkPeriod(tenInQ1(), 1)).toEqual({
      period: 1, appUs: 10, bookUs: null, diff: null, bookOpp: null, oppTapped: 0,
      status: 'pending', note: '',
    });
  });

  test('a period with no events has appUs 0, and matches a book of 0', () => {
    const g = saveReconcile(newGame(info, roster, t0), 2, 0, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ appUs: 0, bookUs: 0, diff: 0, status: 'matched' });
  });

  test('oppTapped reports taps in that period only', () => {
    let g = tenInQ1();
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 2 }, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3, period: 2 }, t0);
    expect(checkPeriod(g, 1).oppTapped).toBe(2);
    expect(checkPeriod(g, 2).oppTapped).toBe(3);
  });
});

describe('saveReconcile', () => {
  test('null book with a note is noted, with bookUs and diff null', () => {
    const g = saveReconcile(tenInQ1(), 1, null, null, 'book lost', t1);
    expect(checkPeriod(g, 1)).toMatchObject({ status: 'noted', bookUs: null, diff: null, note: 'book lost' });
  });

  test('null book without a note stays pending', () => {
    const g = saveReconcile(tenInQ1(), 1, null, 14, '', t1);
    expect(checkPeriod(g, 1)).toMatchObject({ status: 'pending', bookOpp: 14 });
  });

  test('upserts: one record per period, replaced values, bumps updatedAt, does not mutate input', () => {
    const g0 = tenInQ1();
    const g1 = saveReconcile(g0, 1, 10, 8, 'a', t1);
    const g2 = saveReconcile(g1, 1, 10, 9, 'b', t1);
    expect(g2.periods).toHaveLength(1);
    expect(g2.periods[0]).toMatchObject({ bookOpp: 9, note: 'b' });
    expect(g2.updatedAt).toBe(t1.toISOString());
    expect(g0.periods).toEqual([]);
    expect(g1.periods[0].bookOpp).toBe(8);
  });

  test('hadMismatch stays true once set, even when a later save matches', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, '', t1);
    expect(g.periods[0].hadMismatch).toBe(true);
    g = saveReconcile(g, 1, 10, null, '', t1);
    expect(g.periods[0].hadMismatch).toBe(true);
    expect(checkPeriod(g, 1).status).toBe('fixed');
  });

  test('saving a null book does not count as a mismatch', () => {
    const g = saveReconcile(tenInQ1(), 1, null, null, 'x', t1);
    expect(g.periods[0].hadMismatch).toBe(false);
  });

  test('keeps other periods records', () => {
    let g = saveReconcile(tenInQ1(), 1, 10, null, '', t1);
    g = saveReconcile(g, 2, 0, null, '', t1);
    expect(g.periods.map((p) => p.period).sort()).toEqual([1, 2]);
  });
});

describe('period flow', () => {
  test('endPeriod only increments currentPeriod and bumps updatedAt', () => {
    const g0 = tenInQ1();
    const g1 = endPeriod(g0, t1);
    expect(g1).toEqual({ ...g0, currentPeriod: 2, updatedAt: t1.toISOString() });
    expect(g0.currentPeriod).toBe(1);
  });

  test('deferring: ended Q1 with no reconcile is pending and listed in openIssues', () => {
    const g = endPeriod(tenInQ1(), t1);
    const c = checkPeriod(g, 1);
    expect(c.status).toBe('pending');
    expect(c.bookUs).toBeNull();
    expect(c.diff).toBeNull();
    expect(openIssues(g).map((x) => x.period)).toEqual([1]);
  });

  test('openIssues excludes the current period, matched, fixed and noted', () => {
    let g = tenInQ1();
    g = endPeriod(g, t1); // Q1 pending
    expect(openIssues(g).map((x) => x.period)).toEqual([1]);
    const cur = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t1); // Q2, current, pending
    expect(openIssues(cur).map((x) => x.period)).toEqual([1]);
    expect(openIssues(saveReconcile(g, 1, 10, null, '', t1))).toEqual([]);
    expect(openIssues(saveReconcile(g, 1, 12, null, 'ref', t1))).toEqual([]);
    expect(openIssues(saveReconcile(g, 1, null, null, 'lost', t1))).toEqual([]);
    expect(openIssues(saveReconcile(g, 1, 12, null, '', t1)).map((x) => [x.period, x.status])).toEqual([[1, 'unresolved']]);
  });

  test('openIssues is in period order and spans all ended periods', () => {
    let g = tenInQ1();
    g = endPeriod(g, t1);
    g = endPeriod(g, t1);
    g = endPeriod(g, t1); // now in Q4; Q1..Q3 ended
    g = saveReconcile(g, 2, 99, null, '', t1); // unresolved
    g = saveReconcile(g, 3, 5, null, '', t1); // unresolved, saved earlier-period-last order check
    g = saveReconcile(g, 1, 3, null, '', t1);
    expect(openIssues(g).map((x) => [x.period, x.status])).toEqual([
      [1, 'unresolved'], [2, 'unresolved'], [3, 'unresolved'],
    ]);
  });

  test('startOvertime advances the period and clears endedAt', () => {
    const g0 = endPeriod(tenInQ1(), t1);
    const ended = endGame(g0, t1);
    expect(ended.endedAt).toBeDefined();
    const ot = startOvertime(ended, t1);
    expect(ot.endedAt).toBeUndefined();
    expect(ot.currentPeriod).toBe(g0.currentPeriod + 1);
    expect(startOvertime(g0, t1).currentPeriod).toBe(g0.currentPeriod + 1);
  });

  test('endGame sets endedAt without advancing the period, and makes the current period count', () => {
    const g0 = endPeriod(tenInQ1(), t1); // in Q2
    expect(openIssues(g0).map((x) => x.period)).toEqual([1]);
    const g1 = endGame(g0, t1);
    expect(g1.endedAt).toBe(t1.toISOString());
    expect(g1.currentPeriod).toBe(2);
    expect(g1.updatedAt).toBe(t1.toISOString());
    expect(g0.endedAt).toBeUndefined();
    expect(openIssues(g1).map((x) => x.period)).toEqual([1, 2]);
  });

  test('after endGame the current period only appears if it has an issue status', () => {
    let g = endGame(saveReconcile(tenInQ1(), 1, 10, null, '', t1), t1);
    expect(openIssues(g)).toEqual([]);
    g = saveReconcile(g, 1, 14, null, '', t1);
    expect(openIssues(g).map((x) => x.status)).toEqual(['unresolved']);
  });
});

describe('oppTotal', () => {
  test('prefers bookOpp over taps for reconciled periods, taps elsewhere', () => {
    let g = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 2 }, t0); // Q1 tap 2
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3, period: 2 }, t0); // Q2 tap 3
    g = saveReconcile(g, 1, null, 9, '', t1); // Q1 book 9
    expect(oppTotal(g)).toBe(12);
  });

  test('a record with null bookOpp falls back to that periods taps', () => {
    let g = appendEvent(newGame(info, roster, t0), { type: 'OPP_PTS', oppPoints: 2 }, t0);
    g = saveReconcile(g, 1, 0, null, '', t1);
    expect(oppTotal(g)).toBe(2);
  });

  test('bookOpp of 0 is a real value, not a fallback', () => {
    let g = appendEvent(newGame(info, roster, t0), { type: 'OPP_PTS', oppPoints: 2 }, t0);
    g = saveReconcile(g, 1, null, 0, '', t1);
    expect(oppTotal(g)).toBe(0);
  });

  test('a book period with no taps still contributes', () => {
    const g = saveReconcile(newGame(info, roster, t0), 3, null, 7, '', t1);
    expect(oppTotal(g)).toBe(7);
  });

  test('no records and no taps is 0', () => {
    expect(oppTotal(newGame(info, roster, t0))).toBe(0);
  });
});

describe('markExported', () => {
  test('stamps exportedAt and updatedAt, leaves everything else, and repeats cleanly', () => {
    const g = endGame(tenInQ1(), t0);
    const x = markExported(g, t1);
    expect(x.exportedAt).toBe(t1.toISOString());
    expect(x.updatedAt).toBe(t1.toISOString());
    expect(x.endedAt).toBe(g.endedAt);
    expect(x.events).toEqual(g.events);
    const t2 = new Date('2026-11-10T11:00:00Z');
    expect(markExported(x, t2).exportedAt).toBe(t2.toISOString());
  });
});
