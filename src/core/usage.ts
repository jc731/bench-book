import { toCsv } from './csv';
import { slug } from './export-plays';
import type { StorageKeys } from './keys';
import { safeRead, safeRemove, safeWrite } from './storage';
import type { Game } from './types';

export type UsageKind = 'taps' | 'plays' | 'undos' | 'redos' | 'edits' | 'deletes' | 'lateAdds' | 'subs' | 'teamEdits';
export type Usage = Record<UsageKind, number>;

const KINDS: UsageKind[] = ['taps', 'plays', 'undos', 'redos', 'edits', 'deletes', 'lateAdds', 'subs', 'teamEdits'];
export const ZERO_USAGE: Usage = {
  taps: 0, plays: 0, undos: 0, redos: 0, edits: 0, deletes: 0, lateAdds: 0, subs: 0, teamEdits: 0,
};

/** A missing, corrupt or partial record reads as zeros; it never throws. */
export function loadUsage(s: Storage, keys: StorageKeys, gameId: string): Usage {
  const raw = safeRead(s, keys.usagePrefix + gameId);
  if (raw === null) return { ...ZERO_USAGE };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const u = { ...ZERO_USAGE };
    for (const k of KINDS) {
      const v = parsed?.[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) u[k] = v;
    }
    return u;
  } catch {
    return { ...ZERO_USAGE };
  }
}

export function bumpUsage(s: Storage, keys: StorageKeys, gameId: string, kind: UsageKind): Usage {
  const u = loadUsage(s, keys, gameId);
  u[kind] += 1;
  safeWrite(s, keys.usagePrefix + gameId, u);
  return u;
}

/** Removes every usage record under this mode's prefix except `keepId`'s. */
export function pruneUsage(s: Storage, keys: StorageKeys, keepId: string | null): void {
  const found: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k !== null && k.startsWith(keys.usagePrefix)) found.push(k);
    }
  } catch {
    return;
  }
  const keep = keepId === null ? null : keys.usagePrefix + keepId;
  for (const k of found) if (k !== keep) safeRemove(s, k);
}

/** D8: a "fix" is an undo, an edit, a delete or a late add; redos are not. */
export function fixes(u: Usage): number {
  return u.undos + u.edits + u.deletes + u.lateAdds;
}

/** D9: one row, counts only. No team, opponent or player name appears (I11). */
export function usageCsv(g: Game, u: Usage, version: string): string {
  return toCsv([
    ['game_date', 'app_version', 'taps', 'plays', 'undos', 'redos', 'edits', 'deletes', 'late_adds', 'subs', 'team_edits', 'fixes', 'taps_per_play'],
    [g.info.date, version, u.taps, u.plays, u.undos, u.redos, u.edits, u.deletes, u.lateAdds, u.subs, u.teamEdits, fixes(u),
      u.plays === 0 ? '' : (u.taps / u.plays).toFixed(2)],
  ]);
}

export function usageFilename(g: Game): string {
  return `bench-book_${g.info.date}_${slug(g.info.opponent)}_usage.csv`;
}
