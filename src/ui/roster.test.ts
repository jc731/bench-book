import { describe, expect, it } from 'vitest';
import type { Player } from '../core/types';
import { setupRosterErrors, cleanOppRoster, validateOppRoster, cleanRoster, defaultOpponent, opponentOrDefault, validateRoster } from './roster';

const P = (number: string, i = 0): Player => ({ id: String(i), number, name: `Player ${i}`, pos: '' });
const many = (n: number) => Array.from({ length: n }, (_, i) => P(String(i + 1), i));

describe('validateRoster', () => {
  it('allows 0 and 00 as different numbers', () => {
    expect(validateRoster([P('0', 1), P('00', 2)])).toEqual([]);
  });
  it('rejects 1 and " 1 " as duplicates', () => {
    expect(validateRoster([P('1', 1), P(' 1 ', 2)])).toEqual(['Duplicate number: #1.']);
  });
  it('allows 15 players but rejects 16', () => {
    expect(validateRoster(many(15))).toEqual([]);
    expect(validateRoster(many(16))).toEqual(['At most 15 players.']);
  });
  it('rejects blank and whitespace-only numbers', () => {
    expect(validateRoster([P('', 1)])).toEqual(['Every player needs a jersey number.']);
    expect(validateRoster([P('   ', 1)])).toEqual(['Every player needs a jersey number.']);
  });
  it('allows zero players', () => {
    expect(validateRoster([])).toEqual([]);
  });
});

describe('cleanRoster', () => {
  it('trims number and name and blanks the position', () => {
    expect(cleanRoster([{ id: 'a', number: ' 4 ', name: ' Player One ', pos: 'G' }])).toEqual([
      { id: 'a', number: '4', name: 'Player One', pos: '' },
    ]);
  });
});

describe('opponentOrDefault', () => {
  it('uses the typed opponent, trimmed', () => {
    expect(opponentOrDefault('  Test Opp ', '2026-11-13')).toBe('Test Opp');
  });
  it('falls back to the game date as MM-DD when blank', () => {
    expect(opponentOrDefault('   ', '2026-01-05')).toBe('01-05');
    expect(defaultOpponent('2026-11-13')).toBe('11-13');
  });
  it('never leaves the opponent empty, even with no usable date', () => {
    expect(opponentOrDefault('', '')).toBe('Opponent');
  });
});

describe('validateOppRoster', () => {
  it('accepts an empty list and drops blank rows', () => {
    expect(validateOppRoster([])).toEqual([]);
    expect(validateOppRoster([P('', 1)].map((p) => ({ ...p, name: '' })))).toEqual([]);
    expect(cleanOppRoster([{ id: 'a', number: ' ', name: '', pos: '' }, P('4', 2)])).toHaveLength(1);
  });
  it('needs a number when there is a name, and flags duplicates', () => {
    expect(validateOppRoster([P('', 1)])).toEqual(['Every player needs a jersey number.']);
    expect(validateOppRoster([P('4', 1), P('4', 2)])).toEqual(['Duplicate number: #4.']);
  });
});

describe('setupRosterErrors', () => {
  const dup = [{ id: 'a', number: '4', name: 'One', pos: '' }, { id: 'b', number: '4', name: 'Two', pos: '' }];
  it('leaves ours bare, prefixes theirs, and does not merge identical messages across teams', () => {
    expect(setupRosterErrors(dup, [])).toEqual(['Duplicate number: #4.']);
    expect(setupRosterErrors([], dup)).toEqual(['Their roster: Duplicate number: #4.']);
    expect(setupRosterErrors(dup, dup)).toEqual(['Duplicate number: #4.', 'Their roster: Duplicate number: #4.']);
  });
});

describe('Edit teams uses Setup validation (Review Focus 2)', () => {
  it('accepts a Whose number? roster: numbers with empty names, kept empty by the cleaning', () => {
    const theirs: Player[] = ['2', '3', '11'].map((n) => ({ id: `t${n}`, number: n, name: '', pos: '' }));
    expect(setupRosterErrors(many(7), theirs)).toEqual([]);
    expect(cleanOppRoster(theirs).map((p) => p.name)).toEqual(['', '', '']);
  });
});
