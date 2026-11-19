import { describe, expect, test } from 'vitest';
import { storageKeys } from './keys';
import { newGame } from './events';
import { resetDemo } from '../ui/demo';
import { ZERO_USAGE, bumpUsage, fixes, loadUsage, pruneUsage, usageCsv, usageFilename } from './usage';
import type { GameInfo, Player } from './types';

function mem(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}
const real = storageKeys(false);

describe('loadUsage (Review Focus 1)', () => {
  test('empty storage reads as ZERO_USAGE', () => {
    expect(loadUsage(mem(), real, 'g1')).toEqual(ZERO_USAGE);
  });
  test('missing fields read as 0', () => {
    const s = mem();
    s.setItem(`${real.usagePrefix}g1`, '{"taps":3}');
    expect(loadUsage(s, real, 'g1')).toEqual({ ...ZERO_USAGE, taps: 3 });
  });
  test('corrupt JSON reads as ZERO_USAGE', () => {
    const s = mem();
    s.setItem(`${real.usagePrefix}g1`, 'not json');
    expect(loadUsage(s, real, 'g1')).toEqual(ZERO_USAGE);
  });
});

describe('bumpUsage (D7)', () => {
  test('two bumps count 2 for that game only', () => {
    const s = mem();
    bumpUsage(s, real, 'g1', 'taps');
    expect(bumpUsage(s, real, 'g1', 'taps').taps).toBe(2);
    expect(loadUsage(s, real, 'g1').taps).toBe(2);
    expect(loadUsage(s, real, 'g2').taps).toBe(0);
  });
  test('demo keys write the demo key, not the real one (Review Focus 5)', () => {
    const s = mem();
    bumpUsage(s, storageKeys(true), 'g1', 'taps');
    expect(s.getItem('benchbook-demo:usage:g1')).not.toBeNull();
    expect(s.getItem('benchbook:usage:g1')).toBeNull();
  });
  test('resetDemo removes demo usage and leaves real usage (Review Focus 5)', () => {
    const s = mem();
    bumpUsage(s, storageKeys(true), 'g1', 'taps');
    bumpUsage(s, real, 'g1', 'taps');
    resetDemo(s);
    expect(s.getItem('benchbook-demo:usage:g1')).toBeNull();
    expect(s.getItem('benchbook:usage:g1')).not.toBeNull();
  });
});

describe('pruneUsage (D7)', () => {
  test('keeps only the named game and untouched non-usage keys', () => {
    const s = mem();
    bumpUsage(s, real, 'g1', 'taps');
    bumpUsage(s, real, 'g2', 'taps');
    bumpUsage(s, real, 'g3', 'taps');
    s.setItem('benchbook:roster', '[]');
    pruneUsage(s, real, 'g2');
    expect(s.getItem('benchbook:usage:g1')).toBeNull();
    expect(s.getItem('benchbook:usage:g3')).toBeNull();
    expect(s.getItem('benchbook:usage:g2')).not.toBeNull();
    expect(s.getItem('benchbook:roster')).toBe('[]');
  });
  test('null keeps none', () => {
    const s = mem();
    bumpUsage(s, real, 'g1', 'taps');
    pruneUsage(s, real, null);
    expect(s.getItem('benchbook:usage:g1')).toBeNull();
  });
  test('demo prune does not touch real records', () => {
    const s = mem();
    bumpUsage(s, real, 'g1', 'taps');
    pruneUsage(s, storageKeys(true), null);
    expect(s.getItem('benchbook:usage:g1')).not.toBeNull();
  });
});

describe('fixes (D8)', () => {
  test('undos + edits + deletes + lateAdds; redos are not fixes', () => {
    expect(fixes({ ...ZERO_USAGE, undos: 2, edits: 1, deletes: 1, lateAdds: 1, redos: 5 })).toBe(5);
  });
});

describe('usageCsv (D9, I11)', () => {
  const info: GameInfo = {
    team: 'Zephyr Owls', opponent: "Quillon Rams", date: '2026-11-14', homeAway: 'home',
    coach: 'Coach Wren', scorer: 'Scorer Pike', timer: 'Timer Moss',
  };
  const roster: Player[] = [{ id: 'p1', number: '7', name: 'Ondine Farrow', pos: 'G' }];
  const opp: Player[] = [{ id: 'o1', number: '9', name: 'Tamsin Veck', pos: 'F' }];
  const g = newGame(info, roster, new Date('2026-11-14T10:00:00Z'), opp);
  const u = { ...ZERO_USAGE, taps: 10, plays: 4, undos: 1, redos: 2, edits: 3, deletes: 4, lateAdds: 5, subs: 6, teamEdits: 7 };
  const lines = () => usageCsv(g, u, '0.10.0').replace(/^﻿/, '').split('\r\n');

  test('header is exact (D9)', () => {
    expect(lines()[0]).toBe('game_date,app_version,taps,plays,undos,redos,edits,deletes,late_adds,subs,team_edits,fixes,taps_per_play');
  });
  test('one data row; fixes = 1+3+4+5 = 13 (D8); taps_per_play = 10/4 = 2.50', () => {
    expect(lines()).toHaveLength(2);
    expect(lines()[1]).toBe('2026-11-14,0.10.0,10,4,1,2,3,4,5,6,7,13,2.50');
  });
  test('taps_per_play empty when plays is 0', () => {
    const l = usageCsv(g, { ...u, plays: 0 }, '0.10.0').split('\r\n')[1];
    expect(l.endsWith(',')).toBe(true);
  });
  test('no team, opponent, staff or player name appears (I11)', () => {
    const t = usageCsv(g, u, '0.10.0');
    for (const n of ['Zephyr', 'Quillon', 'Wren', 'Pike', 'Moss', 'Ondine', 'Farrow', 'Tamsin', 'Veck']) expect(t).not.toContain(n);
  });
  test('filename uses the exportFilename slug', () => {
    expect(usageFilename(g)).toBe('bench-book_2026-11-14_quillon-rams_usage.csv');
  });
});
