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
  /** The last player promoted by a play since the last sub; null once they foul out. */
  justIn: string | null;
  /** The floor player hinted "longest without a play" in "Who went out?" (decision 10; "likely" before 0.9.1). Only a label. */
  suggestion: string | null;
  /** The roster has more than five players, so there is a bench to track. */
  tracked: boolean;
  /** This team has any play (a timeout or bench tech is not one). */
  playedYet: boolean;
  /** A play changed the floor's count and this team has made no play since (the amber Sub button). */
  changedUnseen: boolean;
}

const PROMOTING = new Set<GameEvent['type']>(['FG2', 'FG3', 'FTM', 'FTX', 'FOUL']);
/** The play types: only these are "that team's play" for `playedYet` and the amber. A timeout or bench tech is not. */
const PLAYS = new Set<GameEvent['type']>([...PROMOTING, 'TECH']);

/** A play that puts a bench player on the floor: +2, +3, FT made or missed, or a foul, by a player not out. */
export function isPromotingPlay(e: GameEvent, wasOut: boolean): boolean {
  return PROMOTING.has(e.type) && !!e.playerId && !wasOut;
}

/** Legacy OPP_PTS taps carry no side but are always theirs (as in `derive`). */
function eventSide(e: GameEvent): Side {
  return e.type === 'OPP_PTS' ? 'them' : sideOf(e);
}

/**
 * The suggested pick among `floor` ("longest without a play"): an out player first, else the one whose last play is oldest (never
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
  // Roster order until the first sub; a sub (D5) or an activity swap (below) changes it.
  let layout: string[] = [...rosterIds];
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
      const wasOnFloor = new Set(floor);
      // D5, I12: one out with no in while a play has just put a sixth on the floor ("comes out", or "Who
      // went out?" after a forgotten sub) is one for one: the just-in player is its in, as recordSubs'
      // toast already reads it. Only the slot swap uses this; the floor is the same either way.
      const impliedIn = ins.length === 0 && outs.length === 1 && floor.length === 6 && justIn !== null && justIn !== outs[0]
        ? justIn
        : null;
      const pairIns = impliedIn ? [impliedIn] : ins;
      floor = floor.filter((id) => !outs.includes(id));
      const applied = new Set<string>();
      for (const id of ins) {
        if (onRoster.has(id) && !out.has(id) && !floor.includes(id)) {
          floor.push(id);
          applied.add(id);
        }
      }
      // D5: an incoming player takes the outgoing player's card slot.
      const prev = layout.filter((id) => onRoster.has(id));
      const slots = [...prev, ...rosterIds.filter((id) => !prev.includes(id))];
      const topCount = layoutFloorIds.length;
      const swapped = new Set<string>();
      const swap = (x: string, y: string) => {
        const a = slots.indexOf(x);
        const b = slots.indexOf(y);
        [slots[a], slots[b]] = [slots[b], slots[a]];
      };
      if (impliedIn) applied.add(impliedIn); // already on: it came on by its play, not by this sub
      for (let k = 0; k < Math.min(pairIns.length, outs.length); k++) {
        const a = slots.indexOf(pairIns[k]);
        const b = slots.indexOf(outs[k]);
        if (a < 0 || b < 0 || !applied.has(pairIns[k]) || !wasOnFloor.has(outs[k])) continue;
        // An activity swap already put the in in the top block: it keeps its slot (handled below).
        if (a < topCount) continue;
        swap(pairIns[k], outs[k]);
        swapped.add(outs[k]);
      }
      // An out leaving the top block trades places with a floor player an activity swap pushed below
      // it (the swap guessed the wrong player off), so the top block refills with two cards moving.
      for (const id of outs) {
        if (swapped.has(id) || !wasOnFloor.has(id) || !slots.includes(id) || slots.indexOf(id) >= topCount) continue;
        const below = slots.slice(topCount).find((x) => floor.includes(x) && !ins.includes(x));
        if (below === undefined) continue;
        swap(id, below);
        swapped.add(id);
      }
      // D5: unpaired outs from the top block go first on the bench; an out already below it stays put.
      const unpairedOuts = outs.filter((id) => wasOnFloor.has(id) && !swapped.has(id) && slots.includes(id) && prev.indexOf(id) < topCount && prev.indexOf(id) >= 0);
      const rest = slots.filter((id) => !floor.includes(id));
      layout = [
        ...slots.filter((id) => floor.includes(id)),
        ...unpairedOuts.filter((id) => rest.includes(id)),
        ...rest.filter((id) => !unpairedOuts.includes(id)),
      ];
      layoutFloorIds = [...floor];
      justIn = null;
      changedUnseen = false;
      return;
    }
    const e = step.e;
    if (!PLAYS.has(e.type)) return;
    playedYet = true;
    const before = floor.length;
    const pid = e.playerId && onRoster.has(e.playerId) ? e.playerId : undefined;
    if (pid) {
      lastPlay.set(pid, i);
      const promotes = !e.late && isPromotingPlay(e, out.has(pid));
      if (promotes && !floor.includes(pid)) {
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
      // Activity swap (owner, 2026-11-23): a promoting play by a card below the top block swaps it with
      // the top-block card whose last play is oldest (an out player first). Two cards move, no more.
      // Late adds never move a card, and neither does the foul that puts this player out. The live screen shows the swap only after a pause in tapping.
      const top = layout.slice(0, layoutFloorIds.length);
      if (promotes && !out.has(pid) && top.length > 0 && !top.includes(pid)) {
        const outNow = rosterIds.filter((id) => out.has(id));
        const swapWith = suggestFrom(top, outNow, lastPlay, layout);
        if (swapWith !== null) {
          const a = layout.indexOf(pid);
          const b = layout.indexOf(swapWith);
          if (a >= 0 && b >= 0) [layout[a], layout[b]] = [layout[b], layout[a]];
        }
      }
    }
    changedUnseen = floor.length !== before;
  });

  // Players added to the roster after the last sub go after the frozen layout, in roster order.
  const frozen: string[] = layout.filter((id) => onRoster.has(id));
  const fullLayout = [...frozen, ...rosterIds.filter((id) => !frozen.includes(id))];
  const outIds = rosterIds.filter((id) => out.has(id));

  return {
    floor,
    bench: benchNow(),
    layout: fullLayout,
    layoutFloor: layoutFloorIds.filter((id) => onRoster.has(id)).length,
    outIds,
    justIn,
    // Ties prefer a floor card below the top block: an activity swap already moved it there as the guess.
    suggestion: suggestFrom(floor, outIds, lastPlay, [
      ...fullLayout.slice(layoutFloorIds.length), ...fullLayout.slice(0, layoutFloorIds.length),
    ]),
    tracked: rosterIds.length > 5,
    playedYet,
    changedUnseen,
  };
}
