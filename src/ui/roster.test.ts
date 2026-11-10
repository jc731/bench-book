import { describe, expect, it } from 'vitest';
import type { Player } from '../core/types';
import { validateRoster } from './roster';

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
  it('rejects zero players', () => {
    expect(validateRoster([])).toEqual(['Add at least one player.']);
  });
});
