import type { Game, Player } from './types';

export const GAME_KEY = 'benchbook:game';
export const ROSTER_KEY = 'benchbook:roster';
export const GAME_TTL_MS = 72 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

function safeRemove(s: Storage, key: string): void {
  try {
    s.removeItem(key);
  } catch {
    // Storage unavailable (e.g. Safari private mode): nothing to clear.
  }
}

function safeRead(s: Storage, key: string): string | null {
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(s: Storage, key: string, value: unknown): boolean {
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
 * old screen called that game exported.
 */
export function migrateGame(g: Game): Game {
  const legacy = g as Game & { exportedAt?: unknown };
  if (legacy.exportedAt === undefined) return g;
  const { exportedAt, ...rest } = legacy;
  if (typeof exportedAt !== 'string' || rest.exported) return rest;
  return { ...rest, exported: { book: exportedAt, plays: exportedAt } };
}

export function loadGame(s: Storage, now: Date): Game | null {
  const raw = safeRead(s, GAME_KEY);
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
    safeRemove(s, GAME_KEY);
    return null;
  }
  return migrateGame(game);
}

export function saveGame(s: Storage, g: Game): boolean {
  return safeWrite(s, GAME_KEY, g);
}

export function clearGame(s: Storage): void {
  safeRemove(s, GAME_KEY);
}

function isPlayer(p: unknown): p is Player {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.number === 'string' && typeof o.name === 'string';
}

export function loadRoster(s: Storage): Player[] {
  const raw = safeRead(s, ROSTER_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isPlayer) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRoster(s: Storage, r: Player[]): boolean {
  return safeWrite(s, ROSTER_KEY, r);
}

export function clearRoster(s: Storage): void {
  safeRemove(s, ROSTER_KEY);
}

export function hoursUntilPurge(g: Game, now: Date): number {
  const ms = Date.parse(g.updatedAt) + GAME_TTL_MS - now.getTime();
  return Math.max(0, ms / HOUR_MS);
}
