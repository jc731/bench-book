import { orderedEvents, rosterOf, sideOf } from './events';
import type { Game, GameEvent, Side, Sub } from './types';

/**
 * One team's floor and bench, derived by replaying its plays and subs (design 2026-11-17, decisions
 * 1–6, 10, 11). Layout only: nothing scored or counted depends on it.
 */
export interface Lineup {
  /** On-floor player ids, in the order they came on. */
  floor: string[];
  /** Everyone else on the roster (out players included), in roster order. */
  bench: string[];
  /** Every roster id in display order, frozen at the last sub (decision 11). */
  layout: string[];
  /**
   * How many of `layout`'s leading ids were on the floor when it was frozen: the starters (five, or the
   * whole roster if smaller) before any sub, else the floor's size at the last sub, which need not be 5.
   * Promotions and foul-outs since don't change it. The live screen keeps these cards in view.
   */
  layoutFloor: number;
  /** Players out on fouls (5 fouls, techs counting, or 2 techs), in roster order. */
  outIds: string[];
  /** The last player promoted by a play since the last sub; null once she fouls out. */
  justIn: string | null;
  /** The floor player marked "likely" in "Who went out?" (decision 10). Only a label. */
  suggestion: string | null;
  /** The roster has more than five players, so there is a bench to track. */
  tracked: boolean;
  /** This team has any play. */
  playedYet: boolean;
  /** A play changed the floor's count and this team has made no play since (the amber Sub button). */
  changedUnseen: boolean;
}

const PROMOTING = new Set<GameEvent['type']>(['FG2', 'FG3', 'FTM', 'FTX', 'FOUL']);

/** A play that puts a bench player on the floor: +2, +3, FT made or missed, or a foul, by a player not out. */
export function isPromotingPlay(e: GameEvent, wasOut: boolean): boolean {
  return PROMOTING.has(e.type) && !!e.playerId && !wasOut;
}

/** Legacy OPP_PTS taps carry no side but are always theirs (as in `derive`). */
function eventSide(e: GameEvent): Side {
  return e.type === 'OPP_PTS' ? 'them' : sideOf(e);
}

/**
 * The "likely" pick among `floor`: an out player first, else the one whose last play is oldest (never
 * played is oldest of all), ties to the earliest in `layout`.
 */
export function suggestFrom(
  floor: string[], outIds: string[], lastPlay: Map<string, number>, layout: string[],
): string | null {
  const pos = (id: string) => {
    const i = layout.indexOf(id);
    return i < 0 ? Infinity : i;
  };
  const byLayout = [...floor].sort((a, b) => pos(a) - pos(b));
  const out = byLayout.find((id) => outIds.includes(id));
  if (out !== undefined) return out;
  let best: string | null = null;
  let bestAt = Infinity;
  for (const id of byLayout) {
    const at = lastPlay.get(id) ?? -1;
    if (best === null || at < bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}

type Step = { kind: 'sub'; sub: Sub } | { kind: 'play'; e: GameEvent };

export function lineup(g: Game, side: Side): Lineup {
  const rosterIds = rosterOf(g, side).map((p) => p.id);
  const onRoster = new Set(rosterIds);

  const steps: Step[] = [
    ...(g.subs ?? []).filter((s) => s.side === side).map((sub): Step => ({ kind: 'sub', sub })),
    ...orderedEvents(g).filter((e) => eventSide(e) === side).map((e): Step => ({ kind: 'play', e })),
  ];
  const orderOf = (s: Step) => (s.kind === 'sub' ? s.sub.order : s.e.order);
  // Stable sort: plays keep their order; on a tie the sub comes first.
  steps.sort((a, b) => orderOf(a) - orderOf(b) || (a.kind === b.kind ? 0 : a.kind === 'sub' ? -1 : 1));

  let floor = rosterIds.slice(0, 5);
  let layout: string[] | null = null; // null until the first sub: roster order
  let layoutFloorIds: string[] = [...floor]; // the floor when the layout was frozen
  const fouls = new Map<string, number>();
  const techs = new Map<string, number>();
  const out = new Set<string>();
  const lastPlay = new Map<string, number>();
  let justIn: string | null = null;
  let playedYet = false;
  let changedUnseen = false;

  const benchNow = () => rosterIds.filter((id) => !floor.includes(id));

  steps.forEach((step, i) => {
    if (step.kind === 'sub') {
      const { ins, outs } = step.sub;
      floor = floor.filter((id) => !outs.includes(id));
      for (const id of ins) {
        if (onRoster.has(id) && !out.has(id) && !floor.includes(id)) floor.push(id);
      }
      layout = [...floor, ...benchNow()];
      layoutFloorIds = [...floor];
      justIn = null;
      changedUnseen = false;
      return;
    }
    const e = step.e;
    playedYet = true;
    const before = floor.length;
    const pid = e.playerId && onRoster.has(e.playerId) ? e.playerId : undefined;
    if (pid) {
      lastPlay.set(pid, i);
      if (isPromotingPlay(e, out.has(pid)) && !floor.includes(pid)) {
        floor.push(pid);
        justIn = pid;
      }
      if (e.type === 'FOUL' || e.type === 'TECH') {
        const f = (fouls.get(pid) ?? 0) + 1;
        const t = (techs.get(pid) ?? 0) + (e.type === 'TECH' ? 1 : 0);
        fouls.set(pid, f);
        techs.set(pid, t);
        if (f >= 5 || t >= 2) {
          out.add(pid);
          floor = floor.filter((id) => id !== pid);
          if (justIn === pid) justIn = null;
        }
      }
    }
    changedUnseen = floor.length !== before;
  });

  // Players added to the roster after the last sub go after the frozen layout, in roster order.
  const frozen: string[] = (layout ?? rosterIds).filter((id) => onRoster.has(id));
  const fullLayout = [...frozen, ...rosterIds.filter((id) => !frozen.includes(id))];
  const outIds = rosterIds.filter((id) => out.has(id));

  return {
    floor,
    bench: benchNow(),
    layout: fullLayout,
    layoutFloor: layoutFloorIds.filter((id) => onRoster.has(id)).length,
    outIds,
    justIn,
    suggestion: suggestFrom(floor, outIds, lastPlay, fullLayout),
    tracked: rosterIds.length > 5,
    playedYet,
    changedUnseen,
  };
}
