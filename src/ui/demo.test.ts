import { describe, expect, it } from 'vitest';
import { loadGame, loadRoster, saveGame, saveRoster } from '../core/storage';
import { newGame } from '../core/events';
import { isDemo, storageKeys } from '../core/keys';
import { DEMO_SETUP, resetDemo } from './demo';

function mem(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const info = { team: 'T', opponent: 'O', date: '2026-01-01', homeAway: 'home' as const, coach: '', scorer: '', timer: '' };

describe('demo', () => {
  it('reads ?demo from the address', () => {
    expect(isDemo('?demo')).toBe(true);
    expect(isDemo('?x=1&demo')).toBe(true);
    expect(isDemo('')).toBe(false);
    expect(isDemo('?demonstrate=1')).toBe(false);
  });
  it('uses keys that differ from the real ones, all three', () => {
    const r = storageKeys(false), d = storageKeys(true);
    expect(r).toEqual({ game: 'benchbook:game', roster: 'benchbook:roster', prefs: 'benchbook:prefs' });
    expect(d.game).not.toBe(r.game);
    expect(d.roster).not.toBe(r.roster);
    expect(d.prefs).not.toBe(r.prefs);
  });
  it('has 8 invented players a side', () => {
    expect(DEMO_SETUP.ours).toHaveLength(8);
    expect(DEMO_SETUP.theirs).toHaveLength(8);
  });
  it('saves and loads under the keys it is given, and resetDemo leaves the real ones', () => {
    const s = mem();
    const real = storageKeys(false), demo = storageKeys(true);
    saveRoster(s, [DEMO_SETUP.ours[0]!], real);
    saveRoster(s, DEMO_SETUP.ours, demo);
    const g = newGame(info, DEMO_SETUP.ours, new Date(), []);
    saveGame(s, g, demo);
    expect(loadGame(s, new Date(), real)).toBeNull();
    expect(loadGame(s, new Date(), demo)).not.toBeNull();
    const before = s.getItem(real.roster);
    resetDemo(s);
    expect(loadGame(s, new Date(), demo)).toBeNull();
    expect(loadRoster(s, demo)).toEqual([]);
    expect(s.getItem(real.roster)).toBe(before);
  });
});
