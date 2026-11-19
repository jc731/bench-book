import { opponentOrDefault } from './opponent';
import type { Game, Player } from './types';

/** What the Edit teams view edits: both team names and both rosters (design 2026-11-19, D10). */
export interface TeamsDraft {
  team: string;
  opponent: string;
  roster: Player[];
  oppRoster: Player[];
}

export function teamsDraftOf(g: Game): TeamsDraft {
  return {
    team: g.info.team,
    opponent: g.info.opponent,
    roster: g.roster.map((p) => ({ ...p })),
    oppRoster: g.oppRoster.map((p) => ({ ...p })),
  };
}

/** D14: players who can't be removed: any play credited to them, or named in any sub's ins or outs. */
export function lockedPlayerIds(g: Game): Set<string> {
  const ids = new Set<string>();
  for (const e of g.events) if (e.playerId) ids.add(e.playerId);
  for (const s of g.subs ?? []) for (const id of [...s.ins, ...s.outs]) ids.add(id);
  return ids;
}

/**
 * D12/D13: existing players stay in their old order with their id and the draft's number and name; a
 * removed one is dropped (a locked one throws, D14); new players are appended in the draft's order.
 */
function mergeRoster(old: Player[], draft: Player[], locked: Set<string>): Player[] {
  const byId = new Map(draft.map((p) => [p.id, p]));
  const oldIds = new Set(old.map((p) => p.id));
  const kept: Player[] = [];
  for (const p of old) {
    const d = byId.get(p.id);
    if (!d) {
      if (locked.has(p.id)) throw new Error(`Player #${p.number} has plays and can't be removed.`);
      continue;
    }
    kept.push({ ...p, number: d.number, name: d.name });
  }
  return [...kept, ...draft.filter((p) => !oldIds.has(p.id))];
}

/**
 * Saves an Edit teams draft. Plays and subs are untouched (I1), so scores, counts and the floor are too;
 * the opponent falls back to the MM-DD default (D11). The caller validates the draft as Setup does and
 * saves through `update`, which drops the export marks (I6); they are dropped here as well. A draft
 * that changes nothing returns `g` itself.
 */
export function applyTeams(g: Game, d: TeamsDraft, now: Date): Game {
  const locked = lockedPlayerIds(g);
  const info = { ...g.info, team: d.team.trim(), opponent: opponentOrDefault(d.opponent, g.info.date) };
  const roster = mergeRoster(g.roster, d.roster, locked);
  const oppRoster = mergeRoster(g.oppRoster, d.oppRoster, locked);
  // Nothing changed: the same game, so `update` adds no undo step and the export marks stand.
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (same(info, g.info) && same(roster, g.roster) && same(oppRoster, g.oppRoster)) return g;
  const { exported: _was, ...rest } = g;
  return { ...rest, info, roster, oppRoster, updatedAt: now.toISOString() };
}
