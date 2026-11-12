import { describe, expect, test } from 'vitest';
import { appendEvent, deleteEvent, insertEventBefore, newGame, orderedEvents } from './events';
import {
  checkPeriod, endGame, endPeriod, isExported, markExported, openIssues, oppTotal, reopenGame, saveReconcile, totalProblem,
  startOvertime,
} from './reconcile';
import type { Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [{ id: 'p1', number: '1', name: 'Player One', pos: 'G' }];
const t0 = new Date('2026-11-10T10:00:00Z');
const t1 = new Date('2026-11-10T10:30:00Z');
const t2 = new Date('2026-11-10T11:00:00Z');

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
    expect(c).toMatchObject({ period: 1, appSpan: 10, bookSpan: 12, diff: 2, status: 'unresolved', note: '' });
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
    expect(c).toMatchObject({ appSpan: 12, bookSpan: 10, diff: -2, status: 'unresolved' });
    const added = g.events.find((e) => e.id !== first.id && e.order < first.order)!;
    g = deleteEvent(g, added.id, t1);
    expect(checkPeriod(g, 1)).toMatchObject({ appSpan: 10, status: 'matched' });
  });

  test('fixed: book 12 vs app 10 unresolved; adding the missing FG2 makes it fixed', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, '', t1);
    expect(checkPeriod(g, 1).status).toBe('unresolved');
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t1);
    expect(checkPeriod(g, 1)).toMatchObject({ appSpan: 12, diff: 0, status: 'fixed' });
  });

  test('a note on a period that then matches is still fixed, not noted', () => {
    let g = saveReconcile(tenInQ1(), 1, 12, null, 'check later', t1);
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t1);
    expect(checkPeriod(g, 1).status).toBe('fixed');
  });

  test('a mismatch seen before the fix makes a matching save read fixed', () => {
    const g = saveReconcile(tenInQ1(), 1, 10, null, '', t1, true);
    expect(g.periods[0].hadMismatch).toBe(true);
    expect(checkPeriod(g, 1).status).toBe('fixed');
  });

  test('matched on first save never sets hadMismatch', () => {
    const g = saveReconcile(tenInQ1(), 1, 10, null, '', t1);
    expect(g.periods[0].hadMismatch).toBe(false);
  });

  test('no record is pending with null book and null diff', () => {
    expect(checkPeriod(tenInQ1(), 1)).toEqual({
      period: 1, spanFrom: 1, anchorBook: 0, anchorApp: 0, bookTotal: null, appTotal: 10, bookSpan: null, appSpan: 10,
      diff: null, oppSpanFrom: 1, anchorOppBook: 0, bookOppTotal: null, bookOppSpan: null, oppTapped: 0,
      status: 'pending', note: '',
    });
  });

  test('a period with no events has appUs 0, and matches a book of 0', () => {
    const g = saveReconcile(newGame(info, roster, t0), 2, 0, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ appSpan: 0, bookSpan: 0, diff: 0, status: 'matched' });
  });

  test('oppTapped counts the taps since the last typed opponent total', () => {
    let g = tenInQ1();
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 2 }, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3, period: 2 }, t0);
    expect(checkPeriod(g, 1).oppTapped).toBe(2);
    expect(checkPeriod(g, 2).oppTapped).toBe(5); // Q1's total not typed: Q1–Q2
    g = saveReconcile(g, 1, 10, 2, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ oppTapped: 3, oppSpanFrom: 2, anchorOppBook: 2 });
  });
});

// Q1: app 10. Q2: app 8 (game 18). Q3: app 6 (game 24).
function threeQuarters(): Game {
  let g = tenInQ1();
  for (let i = 0; i < 4; i++) g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 2 }, t0);
  for (let i = 0; i < 3; i++) g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 3 }, t0);
  return { ...g, currentPeriod: 4 };
}

describe('checks on game totals (the book keeps a running score)', () => {
  test('a quarter is graded on its own points: total minus the last typed total', () => {
    let g = saveReconcile(threeQuarters(), 1, 10, null, '', t1);
    g = saveReconcile(g, 2, 18, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ bookTotal: 18, appTotal: 18, bookSpan: 8, appSpan: 8, spanFrom: 2, status: 'matched' });
  });
  test('a typed Q2 total that is off reads as a mismatch in Q2 by that much', () => {
    let g = saveReconcile(threeQuarters(), 1, 10, null, '', t1);
    g = saveReconcile(g, 2, 20, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ bookSpan: 10, appSpan: 8, diff: 2, status: 'unresolved' });
  });
  test('a gap noted in Q1 is carried, not counted again in Q2', () => {
    let g = saveReconcile(threeQuarters(), 1, 12, null, 'ref changed it', t1); // app 10: 2 short, noted
    g = saveReconcile(g, 2, 20, null, '', t1); // app 18, still 2 short: Q2 itself is right
    expect(checkPeriod(g, 1).status).toBe('noted');
    expect(checkPeriod(g, 2)).toMatchObject({ anchorBook: 12, anchorApp: 10, bookSpan: 8, appSpan: 8, status: 'matched' });
    expect(g.periods.find((p) => p.period === 2)?.hadMismatch).toBe(false);
  });
  test('a skipped quarter widens the next check to cover both (Q2–Q3)', () => {
    let g = saveReconcile(threeQuarters(), 1, 12, null, 'noted', t1);
    g = saveReconcile(g, 3, 26, null, '', t1); // Q2 never checked; app Q2+Q3 = 14
    expect(checkPeriod(g, 3)).toMatchObject({ spanFrom: 2, bookSpan: 14, appSpan: 14, status: 'matched' });
  });
  test('typing an earlier total later re-anchors the later check', () => {
    let g = saveReconcile(threeQuarters(), 2, 18, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ spanFrom: 1, appSpan: 18, status: 'matched' });
    g = saveReconcile(g, 1, 10, null, '', t1);
    expect(checkPeriod(g, 2)).toMatchObject({ spanFrom: 2, bookSpan: 8, appSpan: 8, status: 'matched' });
  });
  test('totalProblem: a running score never goes down', () => {
    let g = saveReconcile(threeQuarters(), 1, 10, 6, '', t1);
    g = saveReconcile(g, 3, 24, 15, '', t1);
    expect(totalProblem(g, 2, 9, 'bookUsTotal')).toBe('Lower than the 10 saved after Q1');
    expect(totalProblem(g, 2, 25, 'bookUsTotal')).toBe('Higher than the 24 saved after Q3');
    expect(totalProblem(g, 2, 10, 'bookUsTotal')).toBeNull();
    expect(totalProblem(g, 2, 24, 'bookUsTotal')).toBeNull();
    expect(totalProblem(g, 2, 5, 'bookOppTotal')).toBe('Lower than the 6 saved after Q1');
    expect(totalProblem(g, 2, null, 'bookUsTotal')).toBeNull();
  });
});

describe('saveReconcile', () => {
  test('null book with a note is noted, with the book and diff null', () => {
    const g = saveReconcile(tenInQ1(), 1, null, null, 'book lost', t1);
    expect(checkPeriod(g, 1)).toMatchObject({ status: 'noted', bookSpan: null, diff: null, note: 'book lost' });
  });

  test('null book without a note stays pending', () => {
    const g = saveReconcile(tenInQ1(), 1, null, 14, '', t1);
    expect(checkPeriod(g, 1)).toMatchObject({ status: 'pending', bookOppTotal: 14 });
  });

  test('upserts: one record per period, replaced values, bumps updatedAt, does not mutate input', () => {
    const g0 = tenInQ1();
    const g1 = saveReconcile(g0, 1, 10, 8, 'a', t1);
    const g2 = saveReconcile(g1, 1, 10, 9, 'b', t1);
    expect(g2.periods).toHaveLength(1);
    expect(g2.periods[0]).toMatchObject({ bookOppTotal: 9, note: 'b' });
    expect(g2.updatedAt).toBe(t1.toISOString());
    expect(g0.periods).toEqual([]);
    expect(g1.periods[0].bookOppTotal).toBe(8);
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
    expect(c.bookSpan).toBeNull();
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

  test('reopenGame clears the end and keeps the period', () => {
    let g = tenInQ1();
    for (let i = 0; i < 4; i++) g = endPeriod(g, t0); // in OT1
    const ended = endGame(g, t1);
    expect(openIssues(ended).map((i) => i.period)).toContain(5);
    const back = reopenGame(ended, t2);
    expect(back.endedAt).toBeUndefined();
    expect(back.currentPeriod).toBe(5);
    expect(back.updatedAt).toBe(t2.toISOString());
    expect(back.events).toBe(ended.events);
    expect(openIssues(back).map((i) => i.period)).not.toContain(5);
  });

  test('reopenGame leaves a live game alone', () => {
    const g = tenInQ1();
    expect(reopenGame(g, t1)).toBe(g);
  });

  test('after endGame the current period only appears if it has an issue status', () => {
    let g = endGame(saveReconcile(tenInQ1(), 1, 10, null, '', t1), t1);
    expect(openIssues(g)).toEqual([]);
    g = saveReconcile(g, 1, 14, null, '', t1);
    expect(openIssues(g).map((x) => x.status)).toEqual(['unresolved']);
  });
});

describe('oppTotal', () => {
  test('the latest typed total plus the taps after it, never the taps before it', () => {
    let g = newGame(info, roster, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 2 }, t0); // Q1 tap 2
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3, period: 2 }, t0); // Q2 tap 3
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 1, period: 3 }, t0); // Q3 tap 1
    g = saveReconcile(g, 2, null, 9, '', t1); // book says 9 after Q2 (taps had 5)
    expect(oppTotal(g)).toBe(10);
  });

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
  test('stamps one file and updatedAt, leaves everything else, and repeats cleanly', () => {
    const g = endGame(tenInQ1(), t0);
    const x = markExported(g, 'book', t1);
    expect(x.exported).toEqual({ book: t1.toISOString() });
    expect(x.updatedAt).toBe(t1.toISOString());
    expect(x.endedAt).toBe(g.endedAt);
    expect(x.events).toEqual(g.events);
    const t2 = new Date('2026-11-10T11:00:00Z');
    expect(markExported(x, 'book', t2).exported).toEqual({ book: t2.toISOString() });
  });

  test('the game is exported only once both files are saved, in either order', () => {
    const g = endGame(tenInQ1(), t0);
    expect(isExported(g)).toBe(false);
    expect(isExported(markExported(g, 'book', t1))).toBe(false);
    expect(isExported(markExported(g, 'plays', t1))).toBe(false);
    expect(isExported(markExported(markExported(g, 'plays', t1), 'book', t1))).toBe(true);
    expect(markExported(markExported(g, 'plays', t0), 'book', t1).exported).toEqual({
      plays: t0.toISOString(), book: t1.toISOString(),
    });
  });
});
