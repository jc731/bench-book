import { storageKeys, type StorageKeys } from './keys';
import type { Game, Player } from './types';

/** The real keys; every load/save/clear takes the keys of the current mode (`storageKeys(demo)`) and defaults to these. */
const REAL = storageKeys(false);
export const GAME_KEY = REAL.game;
export const ROSTER_KEY = REAL.roster;
export const PREFS_KEY = REAL.prefs;
export const GAME_TTL_MS = 72 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

export function safeRemove(s: Storage, key: string): void {
  try {
    s.removeItem(key);
  } catch {
    // Storage unavailable (e.g. Safari private mode): nothing to clear.
  }
}

export function safeRead(s: Storage, key: string): string | null {
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

export function safeWrite(s: Storage, key: string, value: unknown): boolean {
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Brings a stored game up to the current shape. Games saved before per-file export tracking carry
 * a single `exportedAt`, which was set by either button; it is read as both files saved, since the
 * old screen called that game exported. Games saved before 0.9 have no `subs`; it stays absent, and
 * readers (`lineup`) treat absent as no subs.
 */
export function migrateGame(g: Game): Game {
  return migrateOppRoster(migrateChecks(migrateExport(g)));
}

/** Games saved before 0.8 have no opponent roster. */
function migrateOppRoster(g: Game): Game {
  return Array.isArray(g.oppRoster) ? g : { ...g, oppRoster: [] };
}

function migrateExport(g: Game): Game {
  const legacy = g as Game & { exportedAt?: unknown };
  if (legacy.exportedAt === undefined) return g;
  const { exportedAt, ...rest } = legacy;
  if (typeof exportedAt !== 'string' || rest.exported) return rest;
  return { ...rest, exported: { book: exportedAt, plays: exportedAt } };
}

/**
 * Checks saved before 0.3 typed points scored IN the quarter (`bookUs`/`bookOpp`); checks now type the
 * game total. The old numbers mean something else, so they are dropped and those quarters read Not
 * checked again; notes stay. Drafts from then (no `appSpanAtOpen`) are dropped the same way.
 */
function migrateChecks(g: Game): Game {
  const legacyRec = (p: object) => 'bookUs' in p || 'bookOpp' in p;
  const oldPeriods = g.periods.some(legacyRec);
  const drafts = g.checkDrafts ?? {};
  const oldDrafts = Object.values(drafts).some((d) => typeof (d as { appSpanAtOpen?: unknown }).appSpanAtOpen !== 'number');
  if (!oldPeriods && !oldDrafts) return g;
  const periods = g.periods.map((p) => {
    if (!legacyRec(p)) return p;
    const { bookUs: _u, bookOpp: _o, ...rest } = p as typeof p & { bookUs?: unknown; bookOpp?: unknown };
    return { ...rest, bookUsTotal: null, bookOppTotal: null, hadMismatch: false };
  });
  const { checkDrafts: _d, ...rest } = g;
  return { ...rest, periods, ...(oldDrafts || !g.checkDrafts ? {} : { checkDrafts: g.checkDrafts }) };
}

export function loadGame(s: Storage, now: Date, keys: StorageKeys = REAL): Game | null {
  const raw = safeRead(s, keys.game);
  if (raw === null) return null;
  let game: Game | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && (parsed as Game).version === 1) {
      game = parsed as Game;
    }
  } catch {
    game = null;
  }
  const updated = game ? Date.parse(game.updatedAt) : NaN;
  if (!game || Number.isNaN(updated) || now.getTime() - updated > GAME_TTL_MS) {
    safeRemove(s, keys.game);
    return null;
  }
  return migrateGame(game);
}

export function saveGame(s: Storage, g: Game, keys: StorageKeys = REAL): boolean {
  return safeWrite(s, keys.game, g);
}

export function clearGame(s: Storage, keys: StorageKeys = REAL): void {
  safeRemove(s, keys.game);
}

function isPlayer(p: unknown): p is Player {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.number === 'string' && typeof o.name === 'string';
}

export function loadRoster(s: Storage, keys: StorageKeys = REAL): Player[] {
  const raw = safeRead(s, keys.roster);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isPlayer) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRoster(s: Storage, r: Player[], keys: StorageKeys = REAL): boolean {
  return safeWrite(s, keys.roster, r);
}

export function clearRoster(s: Storage, keys: StorageKeys = REAL): void {
  safeRemove(s, keys.roster);
}

export interface Prefs {
  trackOpponentTaps: boolean;
}

export function loadPrefs(s: Storage, keys: StorageKeys = REAL): Prefs {
  const fallback: Prefs = { trackOpponentTaps: false };
  const raw = safeRead(s, keys.prefs);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return typeof parsed?.trackOpponentTaps === 'boolean' ? { trackOpponentTaps: parsed.trackOpponentTaps } : fallback;
  } catch {
    return fallback;
  }
}

export function savePrefs(s: Storage, p: Prefs, keys: StorageKeys = REAL): boolean {
  return safeWrite(s, keys.prefs, p);
}

export function hoursUntilPurge(g: Game, now: Date): number {
  const ms = Date.parse(g.updatedAt) + GAME_TTL_MS - now.getTime();
  return Math.max(0, ms / HOUR_MS);
}
