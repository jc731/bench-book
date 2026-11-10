import { describe, expect, it } from 'vitest';
import { appendEvent, newGame } from '../core/events';
import { endGame } from '../core/reconcile';
import type { Game } from '../core/types';
import { compareText, cumulativeThrough, notExportedText, parseScore, reconcileDraftToSave, statusChipText } from './reconcile-logic';

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
    expect(notExportedText({ ...ended, exportedAt: later.toISOString() }, later)).toBeNull();
  });
});

describe('reconcileDraftToSave', () => {
  const saved = { period: 1, bookUs: 12, bookOpp: null, note: 'n', hadMismatch: true };
  const draft = { bookUs: 12, bookOpp: null, oppDirty: false, note: 'n' };
  it('returns null for an identical draft, and for an empty draft with nothing saved', () => {
    expect(reconcileDraftToSave(saved, draft)).toBeNull();
    expect(reconcileDraftToSave(undefined, { bookUs: null, bookOpp: null, oppDirty: false, note: '' })).toBeNull();
  });
  it('keeps bookOpp null when the opponent field was only prefilled', () => {
    expect(reconcileDraftToSave(undefined, { bookUs: 12, bookOpp: 9, oppDirty: false, note: '' })).toEqual({
      bookUs: 12, bookOpp: null, note: '',
    });
    expect(reconcileDraftToSave(saved, { ...draft, bookOpp: 9 })).toBeNull();
  });
  it('saves an edited opponent number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, bookOpp: 9, oppDirty: true })).toEqual({
      bookUs: 12, bookOpp: 9, note: 'n',
    });
  });
  it('saves a changed note and a changed book number', () => {
    expect(reconcileDraftToSave(saved, { ...draft, note: 'm' })?.note).toBe('m');
    expect(reconcileDraftToSave(saved, { ...draft, bookUs: 10 })?.bookUs).toBe(10);
  });
});
