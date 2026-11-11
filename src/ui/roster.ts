import type { Player } from '../core/types';

export const MAX_PLAYERS = 15;

export function validateRoster(players: Player[]): string[] {
  const errors: string[] = [];
  if (players.length < 1) errors.push('Add at least one player.');
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

/** The roster as saved: trimmed, with no position (Setup no longer asks for one). */
export function cleanRoster(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, number: p.number.trim(), name: (p.name ?? '').trim(), pos: '' }));
}
