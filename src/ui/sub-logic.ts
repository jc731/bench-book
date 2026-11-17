import type { Lineup } from '../core/lineup';

/**
 * The sub sheet's rules (design 2026-11-17, decisions 7 and 9), kept out of the component so each can be
 * tested: which mode it opens in, what a tap does, when it closes on its own and what it records.
 */

/** `out`: "Who went out?" (floor above 5). `in`: "Who came in?" (below 5). `set`: "Who's on the floor?". */
export type SubMode = 'out' | 'in' | 'set';

export const SUB_TITLE: Record<SubMode, string> = {
  out: 'Who went out?',
  in: 'Who came in?',
  set: "Who's on the floor?",
};

/** The player a play sheet's sub row has already moved: a bench player in, or a floor player out. */
export type SubStart = { in?: string; out?: string } | null;

type LineupView = Pick<Lineup, 'floor' | 'outIds' | 'playedYet'>;

/**
 * The selection the sheet opens with and its mode. The start player is moved first, then the mode
 * follows the floor's size; Starters (before the team's first play, opened from the Sub button) always
 * asks "Who's on the floor?".
 */
export function openSub(l: LineupView, start: SubStart): { mode: SubMode; floor: string[] } {
  let floor = l.floor.filter((id) => id !== start?.out);
  if (start?.in && !floor.includes(start.in) && !l.outIds.includes(start.in)) floor = [...floor, start.in];
  const mode: SubMode = !start && !l.playedYet ? 'set' : floor.length > 5 ? 'out' : floor.length < 5 ? 'in' : 'set';
  return { mode, floor };
}

/** One tap on a player: off the floor if on, on it if off. An out player is never put on. */
export function toggleFloor(floor: string[], id: string, outIds: string[]): string[] {
  if (floor.includes(id)) return floor.filter((x) => x !== id);
  return outIds.includes(id) ? floor : [...floor, id];
}

/** "Who went out?" and "Who came in?" close, and record, as the floor reaches five. "Who's on the floor?" waits for Done. */
export function closesNow(mode: SubMode, floor: string[]): boolean {
  return mode !== 'set' && floor.length === 5;
}

/**
 * The line under "Who went out?" and "Who came in?": how many are on and how many taps bring the floor to
 * five, `8 on · pick 3`, so the scorer knows the sheet closes on the last pick. Null for "Who's on the
 * floor?", which has its own count and Done.
 */
export function pickText(mode: SubMode, onFloor: number): string | null {
  if (mode === 'set') return null;
  return `${onFloor} on · pick ${Math.abs(onFloor - 5)}`;
}

/**
 * The suggestion's words in "Who went out?". It was "likely", and it guessed wrong in both reviewer runs
 * (0.9.0) while reading like an instruction; it now says why the player is suggested and nothing more.
 */
export const SUGGESTION_TAG = 'longest without a play';

/** A row's tags: a `fact` (just in, an out reason) is a boxed tag; the suggestion is a `hint`, quieter. */
export type RowTag = { text: string; kind: 'fact' | 'hint' };

/** The tags on a sub sheet row: an out player's reason alone; in "Who went out?", just in and the suggestion. */
export function rowTags(
  id: string,
  outReason: string | null,
  c: { mode: SubMode; justIn: string | null | undefined; suggestion: string | null },
): RowTag[] {
  if (outReason) return [{ text: outReason, kind: 'fact' }];
  if (c.mode !== 'out') return [];
  return [
    ...(id === c.justIn ? [{ text: 'just in', kind: 'fact' as const }] : []),
    ...(id === c.suggestion ? [{ text: SUGGESTION_TAG, kind: 'hint' as const }] : []),
  ];
}

/** The net change from the floor when the sheet opened: who went in (in the order tapped) and who came out. */
export function netSub(before: string[], after: string[]): { ins: string[]; outs: string[] } {
  return { ins: after.filter((id) => !before.includes(id)), outs: before.filter((id) => !after.includes(id)) };
}

/** The play sheet's sub row: `#22 checks in` for a bench player, `#10 comes out` for a floor player; none for an out player. */
export function subRowText(l: Pick<Lineup, 'floor' | 'outIds'>, id: string, number: string): string | null {
  if (l.floor.includes(id)) return `#${number} comes out`;
  if (l.outIds.includes(id)) return null;
  return `#${number} checks in`;
}
