import { describe, expect, it } from 'vitest';
import {
  GAME_KEY,
  GAME_TTL_MS,
  ROSTER_KEY,
  clearGame,
  clearRoster,
  hoursUntilPurge,
  PREFS_KEY,
  loadGame,
  loadPrefs,
  savePrefs,
  loadRoster,
  migrateGame,
  saveGame,
  saveRoster,
} from './storage';
import type { Game, Player } from './types';

class FakeStorage implements Storage {
  data = new Map<string, string>();
  failGet = false;
  failSet = false;
  failRemove = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    if (this.failGet) throw new Error('SecurityError');
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    if (this.failRemove) throw new Error('SecurityError');
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
}

const T0 = new Date('2026-11-10T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 60 * 60 * 1000;

function game(updatedAt = T0.toISOString()): Game {
  return {
    version: 1,
    id: 'g1',
    info: {
      team: 'Home Team',
      opponent: 'Away Team',
      date: '2026-11-10',
      homeAway: 'home',
      coach: '',
      scorer: '',
      timer: '',
    },
    roster: [{ id: 'p1', number: '1', name: 'Player One', pos: 'G' }],
    events: [],
    currentPeriod: 1,
    periods: [],
    trackOpponentTaps: false,
    createdAt: T0.toISOString(),
    updatedAt,
  };
}

const roster: Player[] = [
  { id: 'p1', number: '1', name: 'Player One', pos: 'G' },
  { id: 'p2', number: '2', name: 'Player Two', pos: 'F' },
];

describe('game retention', () => {
  it('returns the game at +71h', () => {
    const s = new FakeStorage();
    saveGame(s, game());
    expect(loadGame(s, at(71 * HOUR))).toEqual(game());
  });

  it('purges at +73h and removes the key', () => {
    const s = new FakeStorage();
    saveGame(s, game());
    expect(loadGame(s, at(73 * HOUR))).toBeNull();
    expect(s.data.has(GAME_KEY)).toBe(false);
  });

  it('keeps the game at exactly the TTL and purges 1 ms later', () => {
    const s = new FakeStorage();
    saveGame(s, game());
    expect(loadGame(s, at(GAME_TTL_MS))).not.toBeNull();
    expect(loadGame(s, at(GAME_TTL_MS + 1))).toBeNull();
    expect(s.data.has(GAME_KEY)).toBe(false);
  });

  it('a stale game does not survive being reloaded fresh', () => {
    const s = new FakeStorage();
    saveGame(s, game());
    loadGame(s, at(100 * HOUR));
    expect(loadGame(s, T0)).toBeNull();
  });

  it('treats an unparseable updatedAt as invalid and purges', () => {
    const s = new FakeStorage();
    saveGame(s, game('not a date'));
    expect(loadGame(s, T0)).toBeNull();
    expect(s.data.has(GAME_KEY)).toBe(false);
  });
});

describe('invalid data', () => {
  it('corrupt JSON returns null without throwing and clears the key', () => {
    const s = new FakeStorage();
    s.data.set(GAME_KEY, '{nope');
    expect(loadGame(s, T0)).toBeNull();
    expect(s.data.has(GAME_KEY)).toBe(false);
  });

  it('wrong version returns null', () => {
    const s = new FakeStorage();
    s.data.set(GAME_KEY, JSON.stringify({ ...game(), version: 2 }));
    expect(loadGame(s, T0)).toBeNull();
  });

  it('JSON null or a non-object returns null', () => {
    const s = new FakeStorage();
    s.data.set(GAME_KEY, 'null');
    expect(loadGame(s, T0)).toBeNull();
    s.data.set(GAME_KEY, '42');
    expect(loadGame(s, T0)).toBeNull();
  });

  it('missing key returns null', () => {
    expect(loadGame(new FakeStorage(), T0)).toBeNull();
  });

  it('loadGame, loadRoster, clears never throw when storage throws', () => {
    const s = new FakeStorage();
    s.failGet = true;
    s.failRemove = true;
    expect(loadGame(s, T0)).toBeNull();
    expect(loadRoster(s)).toEqual([]);
    expect(() => clearGame(s)).not.toThrow();
    expect(() => clearRoster(s)).not.toThrow();
  });
});

describe('save', () => {
  it('reports success', () => {
    const s = new FakeStorage();
    expect(saveGame(s, game())).toBe(true);
    expect(s.data.has(GAME_KEY)).toBe(true);
    expect(saveRoster(s, roster)).toBe(true);
  });

  it('reports failure instead of throwing', () => {
    const s = new FakeStorage();
    s.failSet = true;
    expect(saveGame(s, game())).toBe(false);
    expect(saveRoster(s, roster)).toBe(false);
  });

  it('clearGame removes the game', () => {
    const s = new FakeStorage();
    saveGame(s, game());
    clearGame(s);
    expect(s.data.has(GAME_KEY)).toBe(false);
  });
});

describe('roster', () => {
  it('survives regardless of age', () => {
    const s = new FakeStorage();
    saveRoster(s, roster);
    saveGame(s, game());
    loadGame(s, at(1000 * HOUR)); // purges the game
    expect(loadRoster(s)).toEqual(roster);
  });

  it('clearRoster empties it', () => {
    const s = new FakeStorage();
    saveRoster(s, roster);
    clearRoster(s);
    expect(loadRoster(s)).toEqual([]);
    expect(s.data.has(ROSTER_KEY)).toBe(false);
  });

  it('returns [] for missing, corrupt, non-array or malformed players', () => {
    const s = new FakeStorage();
    expect(loadRoster(s)).toEqual([]);
    s.data.set(ROSTER_KEY, '{nope');
    expect(loadRoster(s)).toEqual([]);
    s.data.set(ROSTER_KEY, '{"a":1}');
    expect(loadRoster(s)).toEqual([]);
    s.data.set(ROSTER_KEY, JSON.stringify([{ id: 'p1', number: 1, name: 'Player One' }]));
    expect(loadRoster(s)).toEqual([]);
    s.data.set(ROSTER_KEY, JSON.stringify([null]));
    expect(loadRoster(s)).toEqual([]);
  });
});

describe('hoursUntilPurge', () => {
  it('counts down from 72', () => {
    expect(hoursUntilPurge(game(), T0)).toBe(72);
    expect(hoursUntilPurge(game(), at(48 * HOUR))).toBe(24);
    expect(hoursUntilPurge(game(), at(71.5 * HOUR))).toBe(0.5);
  });

  it('clamps at 0 once past the TTL', () => {
    expect(hoursUntilPurge(game(), at(72 * HOUR))).toBe(0);
    expect(hoursUntilPurge(game(), at(100 * HOUR))).toBe(0);
  });
});

describe('migrateGame (per-file export state)', () => {
  const stamp = '2026-11-10T13:00:00.000Z';
  it('reads the old single exportedAt as both files saved, and drops it', () => {
    const old = { ...game(), exportedAt: stamp } as Game;
    const m = migrateGame(old);
    expect(m.exported).toEqual({ book: stamp, plays: stamp });
    expect('exportedAt' in m).toBe(false);
  });
  it('leaves a game without the old flag untouched', () => {
    const g = { ...game(), exported: { book: stamp } };
    expect(migrateGame(g)).toBe(g);
    expect(migrateGame(game()).exported).toBeUndefined();
  });
  it('keeps the new state when both shapes are present, and ignores a malformed old flag', () => {
    const both = { ...game(), exported: { plays: stamp }, exportedAt: stamp } as Game;
    expect(migrateGame(both).exported).toEqual({ plays: stamp });
    const bad = { ...game(), exportedAt: 42 } as unknown as Game;
    expect(migrateGame(bad).exported).toBeUndefined();
    expect('exportedAt' in migrateGame(bad)).toBe(false);
  });
  it('is applied by loadGame', () => {
    const s = new FakeStorage();
    s.data.set(GAME_KEY, JSON.stringify({ ...game(), exportedAt: stamp }));
    expect(loadGame(s, T0)?.exported).toEqual({ book: stamp, plays: stamp });
  });
});

describe('prefs', () => {
  it('defaults to not keeping the opponent score', () => {
    expect(loadPrefs(new FakeStorage())).toEqual({ trackOpponentTaps: false });
  });
  it('round-trips true and then false', () => {
    const s = new FakeStorage();
    expect(savePrefs(s, { trackOpponentTaps: true })).toBe(true);
    expect(loadPrefs(s)).toEqual({ trackOpponentTaps: true });
    savePrefs(s, { trackOpponentTaps: false });
    expect(loadPrefs(s)).toEqual({ trackOpponentTaps: false });
  });
  it('falls back to the default on malformed JSON or a wrong type', () => {
    const s = new FakeStorage();
    s.setItem(PREFS_KEY, '{nope');
    expect(loadPrefs(s)).toEqual({ trackOpponentTaps: false });
    s.setItem(PREFS_KEY, '{"trackOpponentTaps":"yes"}');
    expect(loadPrefs(s)).toEqual({ trackOpponentTaps: false });
  });
});
