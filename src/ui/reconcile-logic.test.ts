import { describe, expect, it } from 'vitest';
import { appendEvent, newGame } from '../core/events';
import { endGame, markExported } from '../core/reconcile';
import type { Game } from '../core/types';
import {
  MISMATCH_HINT, appHasText, compareText, cumulativeThrough, exportStateText, issueAction, sawMismatch, notExportedText, oppCompareText, oppPlaceholder, parseScore,
  reconcileDraftToSave, statusChipText,
} from './reconcile-logic';

const t0 = new Date('2026-11-10T10:00:00Z');
const base = (): Game =>
  newGame(
    { team: 'A', opponent: 'B', date: '2026-11-10', homeAway: 'home', coach: '', scorer: '', timer: '' },
    [{ id: 'p1', number: '1', name: 'Player One', pos: '' }],
    t0,
  );

describe('compareText', () => {
  it('reads short, over, matches and not-entered', () => {
    expect(compareText(12, 10)).toBe('Book 12 · App 10 — app is 2 short');
    expect(compareText(8, 10)).toBe('Book 8 · App 10 — app is 2 over');
    expect(compareText(10, 10)).toBe('✓ Matches');
    expect(compareText(null, 10)).toBeNull();
    expect(compareText(0, 0)).toBe('✓ Matches');
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
    expect(oppCompareText(null, 6, true)).toBe('Opponent not compared (box blank)');
    expect(oppCompareText(null, 0, true)).not.toMatch(/match|✓/i);
    expect(oppCompareText(null, 0, false)).toBeNull();
  });
  it('compares a typed number with the taps', () => {
    expect(oppCompareText(6, 6, true)).toBe('Opponent: book 6 · taps 6 ✓');
    expect(oppCompareText(6, 4, true)).toBe('Opponent: book 6 · taps 4 — taps are 2 short');
    expect(oppCompareText(3, 4, true)).toBe('Opponent: book 3 · taps 4 — taps are 1 over');
    expect(oppCompareText(6, 0, false)).toBe('Opponent 6 from the book (no taps to compare)');
  });
  it('shows the tap total only as a placeholder', () => {
    expect(oppPlaceholder(3, true)).toBe('3 from taps');
    expect(oppPlaceholder(3, false)).toBe('');
  });
});

describe('reconcileDraftToSave', () => {
  const saved = { period: 1, bookUs: 12, bookOpp: null, note: 'n', hadMismatch: true };
  const draft = { bookUs: 12, bookOpp: null, note: 'n' };
  it('returns null for an identical draft, and for an empty draft with nothing saved', () => {
    expect(reconcileDraftToSave(saved, draft)).toBeNull();
    expect(reconcileDraftToSave(undefined, { bookUs: null, bookOpp: null, note: '' })).toBeNull();
  });
  it('saves a blank opponent box as no book number', () => {
    expect(reconcileDraftToSave(undefined, { bookUs: 12, bookOpp: null, note: '' })).toEqual({
      bookUs: 12, bookOpp: null, note: '',
    });
    expect(reconcileDraftToSave({ ...saved, bookOpp: 9 }, draft)?.bookOpp).toBeNull();
  });
  it('saves a typed opponent number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, bookOpp: 9 })).toEqual({
      bookUs: 12, bookOpp: 9, note: 'n',
    });
  });
  it('saves a changed note and a changed book number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, note: 'm' })?.note).toBe('m');
    expect(reconcileDraftToSave(saved, { ...draft, bookUs: 10 })?.bookUs).toBe(10);
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
  it('puts the quarter first, then the game score through it', () => {
    expect(appHasText(twoQuarters(true), 2)).toBe('App has Q2: Us 3 · Them 2 (game 5–5)');
    expect(appHasText(twoQuarters(true), 1)).toBe('App has Q1: Us 2 · Them 3 (game 2–3)');
  });
  it('leaves Them out when opponent taps are off', () => {
    expect(appHasText(twoQuarters(false), 2)).toBe('App has Q2: Us 3 (game 5)');
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
