import type { Player } from '../core/types';

export const MAX_PLAYERS = 15;

export function validateRoster(players: Player[]): string[] {
  const errors: string[] = [];
  if (players.length > MAX_PLAYERS) errors.push(`At most ${MAX_PLAYERS} players.`);
  if (players.some((p) => p.number.trim() === '')) errors.push('Every player needs a jersey number.');
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const p of players) {
    const n = p.number.trim();
    if (n === '') continue;
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  if (dupes.size) errors.push(`Duplicate number: ${[...dupes].map((n) => '#' + n).join(', ')}.`);
  return errors;
}

/** Blank rows (no number, no name) are dropped; the rest are cleaned like ours. */
export function cleanOppRoster(players: Player[]): Player[] {
  return cleanRoster(players.filter((p) => p.number.trim() !== '' || (p.name ?? '').trim() !== ''));
}

/** Like validateRoster, but the opponent's list may be empty. */
export function validateOppRoster(players: Player[]): string[] {
  const kept = cleanOppRoster(players);
  return kept.length === 0 ? [] : validateRoster(kept);
}

/** Both rosters' problems for Setup; theirs are prefixed so the scorer knows which list to fix. */
export function setupRosterErrors(ours: Player[], theirs: Player[]): string[] {
  return [...validateOppRoster(ours), ...validateOppRoster(theirs).map((e) => `Their roster: ${e}`)];
}

/** The roster as saved: trimmed, with no position (Setup no longer asks for one). */
export function cleanRoster(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, number: p.number.trim(), name: (p.name ?? '').trim(), pos: '' }));
}

// Moved to core so Edit teams' save (src/core/edit-teams.ts) can use them; re-exported for the UI.
export { defaultOpponent, opponentOrDefault } from '../core/opponent';
