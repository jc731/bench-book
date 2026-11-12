import { describe, expect, it } from 'vitest';
import { appendEvent, newGame } from '../core/events';
import { endGame, markExported } from '../core/reconcile';
import type { Game } from '../core/types';
import {
  MISMATCH_HINT, appHasText, compareText, isMismatch, cumulativeThrough, exportStateText, issueAction, sawMismatch, notExportedText, oppCompareText, oppPlaceholder, parseScore,
  reconcileDraftToSave, statusChipText,
} from './reconcile-logic';

const t0 = new Date('2026-11-10T10:00:00Z');
const base = (): Game =>
  newGame(
    { team: 'A', opponent: 'B', date: '2026-11-10', homeAway: 'home', coach: '', scorer: '', timer: '' },
    [{ id: 'p1', number: '1', name: 'Player One', pos: '' }],
    t0,
  );

describe('compareText (typed game totals)', () => {
  const q1 = { period: 1, spanFrom: 1, anchorBook: 0, anchorApp: 0, appTotal: 10, appSpan: 10 };
  it('reads short, over, matches and not-entered in Q1', () => {
    expect(compareText(12, q1)).toBe('Book 12 · App 10 — app is 2 short in Q1');
    expect(compareText(8, q1)).toBe('Book 8 · App 10 — app is 2 over in Q1');
    expect(compareText(10, q1)).toBe('✓ Matches');
    expect(compareText(null, q1)).toBeNull();
    expect(compareText(0, { ...q1, appTotal: 0, appSpan: 0 })).toBe('✓ Matches');
  });
  // Q1 noted at book 12 vs app 10; Q2 the app scored 8 (game 18).
  const q2 = { period: 2, spanFrom: 2, anchorBook: 12, anchorApp: 10, appTotal: 18, appSpan: 8 };
  it('grades Q2 on its own points and names a gap carried from Q1', () => {
    expect(compareText(20, q2)).toBe('✓ Q2 matches — app still 2 short from Q1');
    expect(isMismatch(20, q2)).toBe(false);
    expect(compareText(22, q2)).toBe('Book 22 · App 18 — app is 2 short in Q2 (already 2 short after Q1)');
    expect(isMismatch(22, q2)).toBe(true);
  });
  it('names the span when an earlier check was skipped', () => {
    const q3 = { period: 3, spanFrom: 2, anchorBook: 10, anchorApp: 10, appTotal: 24, appSpan: 14 };
    expect(compareText(25, q3)).toBe('Book 25 · App 24 — app is 1 short in Q2–Q3');
  });
});

describe('cumulativeThrough', () => {
  it('adds periods up to and including the one asked for', () => {
    let g = base();
    g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0); // Q1: 2
    g = { ...g, currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG3', playerId: 'p1' }, t0); // Q2: 3
    g = { ...g, currentPeriod: 3 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0); // Q3: 2
    expect(cumulativeThrough(g, 1)).toBe(2);
    expect(cumulativeThrough(g, 2)).toBe(5);
    expect(cumulativeThrough(g, 3)).toBe(7);
    expect(cumulativeThrough(g, 4)).toBe(7);
  });
});

describe('statusChipText', () => {
  it('has distinct text for every status', () => {
    const all = (['pending', 'matched', 'fixed', 'noted', 'unresolved'] as const).map(statusChipText);
    expect(new Set(all).size).toBe(5);
    expect(statusChipText('fixed')).toBe('✓ Fixed');
    expect(statusChipText('unresolved')).toBe('Mismatch');
  });
});

describe('parseScore', () => {
  it('treats empty as not entered and rejects negatives and junk', () => {
    expect(parseScore('')).toEqual({ kind: 'empty' });
    expect(parseScore('  ')).toEqual({ kind: 'empty' });
    expect(parseScore('12')).toEqual({ kind: 'ok', value: 12 });
    expect(parseScore('0')).toEqual({ kind: 'ok', value: 0 });
    expect(parseScore('-3')).toEqual({ kind: 'invalid' });
    expect(parseScore('1.5')).toEqual({ kind: 'invalid' });
    expect(parseScore('abc')).toEqual({ kind: 'invalid' });
  });
});

describe('notExportedText', () => {
  it('warns only for an ended game that has not been exported, rounding hours up', () => {
    const g = base();
    const ended = endGame(g, t0);
    const later = new Date(t0.getTime() + 2.5 * 3600_000);
    expect(notExportedText(g, later)).toBeNull();
    expect(notExportedText(ended, later)).toBe('Not exported — game data clears in 70 h');
    expect(notExportedText(markExported(markExported(ended, 'book', later), 'plays', later), later)).toBeNull();
  });
  it('still warns when only one file was saved', () => {
    const ended = endGame(base(), t0);
    const later = new Date(t0.getTime() + 2.5 * 3600_000);
    expect(notExportedText(markExported(ended, 'book', later), later)).toMatch(/^Not exported/);
    expect(notExportedText(markExported(ended, 'plays', later), later)).toMatch(/^Not exported/);
  });
});

describe('exportStateText', () => {
  it('shows each file on its own', () => {
    const g = markExported(base(), 'book', t0);
    expect(exportStateText(g, 'book')).toBe('Book CSV ✓ saved');
    expect(exportStateText(g, 'plays')).toBe('Plays CSV — not saved yet');
  });
});

describe('opponent check', () => {
  it('never compares, and never says it matches, a blank opponent box', () => {
    const c = (taps: number) => ({ period: 1, oppSpanFrom: 1, anchorOppBook: 0, oppTapped: taps });
    expect(oppCompareText(null, c(6), true)).toBe('Opponent not compared (box blank)');
    expect(oppCompareText(null, c(0), true)).not.toMatch(/match|✓/i);
    expect(oppCompareText(null, c(0), false)).toBeNull();
  });
  it('compares a typed game total with the taps since the last typed total', () => {
    const q1 = (taps: number) => ({ period: 1, oppSpanFrom: 1, anchorOppBook: 0, oppTapped: taps });
    expect(oppCompareText(6, q1(6), true)).toBe('Opponent: book 6 · taps 6 ✓');
    expect(oppCompareText(6, q1(4), true)).toBe('Opponent: book 6 · taps 4 — taps are 2 short in Q1');
    expect(oppCompareText(3, q1(4), true)).toBe('Opponent: book 3 · taps 4 — taps are 1 over in Q1');
    expect(oppCompareText(6, q1(0), false)).toBe('Opponent 6 from the book (no taps to compare)');
    // Q1 typed 9 (taps had 7); Q2 tapped 5: the taps' game total is 14.
    const q2 = { period: 2, oppSpanFrom: 2, anchorOppBook: 9, oppTapped: 5 };
    expect(oppCompareText(14, q2, true)).toBe('Opponent: book 14 · taps 14 ✓');
  });
  it('shows the taps\' game total only as a placeholder', () => {
    expect(oppPlaceholder({ period: 2, oppSpanFrom: 2, anchorOppBook: 9, oppTapped: 3 }, true)).toBe('12 from taps');
    expect(oppPlaceholder({ period: 2, oppSpanFrom: 2, anchorOppBook: 9, oppTapped: 3 }, false)).toBe('');
  });
});

describe('reconcileDraftToSave', () => {
  const saved = { period: 1, bookUsTotal: 12, bookOppTotal: null, note: 'n', hadMismatch: true };
  const draft = { bookUsTotal: 12, bookOppTotal: null, note: 'n' };
  it('returns null for an identical draft, and for an empty draft with nothing saved', () => {
    expect(reconcileDraftToSave(saved, draft)).toBeNull();
    expect(reconcileDraftToSave(undefined, { bookUsTotal: null, bookOppTotal: null, note: '' })).toBeNull();
  });
  it('saves a blank opponent box as no book number', () => {
    expect(reconcileDraftToSave(undefined, { bookUsTotal: 12, bookOppTotal: null, note: '' })).toEqual({
      bookUsTotal: 12, bookOppTotal: null, note: '',
    });
    expect(reconcileDraftToSave({ ...saved, bookOppTotal: 9 }, draft)?.bookOppTotal).toBeNull();
  });
  it('saves a typed opponent number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, bookOppTotal: 9 })).toEqual({
      bookUsTotal: 12, bookOppTotal: 9, note: 'n',
    });
  });
  it('saves a changed note and a changed book number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, note: 'm' })?.note).toBe('m');
    expect(reconcileDraftToSave(saved, { ...draft, bookUsTotal: 10 })?.bookUsTotal).toBe(10);
  });
});

describe('issueAction', () => {
  it('offers Check for a quarter never checked, Reopen otherwise', () => {
    expect(issueAction('pending')).toBe('Check');
    expect(issueAction('unresolved')).toBe('Reopen');
    expect(issueAction('noted')).toBe('Reopen');
  });
});

describe('check screen text', () => {
  const twoQuarters = (track: boolean): Game => {
    let g = { ...base(), trackOpponentTaps: track, currentPeriod: 2 };
    g = appendEvent(g, { type: 'FG2', playerId: 'p1', period: 1 }, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3, period: 1 }, t0);
    g = appendEvent(g, { type: 'FG3', playerId: 'p1', period: 2 }, t0);
    g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 2, period: 2 }, t0);
    return g;
  };
  it('leads with the game score after the quarter, then the quarter on its own', () => {
    expect(appHasText(twoQuarters(true), 2)).toBe('App after Q2: Us 5 · Them 5 (Q2: 3–2)');
    expect(appHasText(twoQuarters(true), 1)).toBe('App after Q1: Us 2 · Them 3 (Q1: 2–3)');
  });
  it('leaves Them out when opponent taps are off', () => {
    expect(appHasText(twoQuarters(false), 2)).toBe('App after Q2: Us 5 (Q2: 3)');
  });
  it('words the mismatch hint', () => {
    expect(MISMATCH_HINT).toBe('Add the missing play, fix one below, or write a note and Save.');
  });
  it('sees a mismatch only against the app as it stood when the check opened', () => {
    expect(sawMismatch(9, 7)).toBe(true);
    expect(sawMismatch(7, 7)).toBe(false);
    expect(sawMismatch(null, 7)).toBe(false);
    expect(sawMismatch(9, null)).toBe(false);
  });
});
