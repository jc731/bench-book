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
