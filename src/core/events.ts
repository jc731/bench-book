import type { EventDraft, Game, GameEvent, GameInfo, Player, Side, Sub } from './types';

export function orderedEvents(g: Game): GameEvent[] {
  return [...g.events].sort((a, b) => a.order - b.order);
}

export function sideOf(e: GameEvent): Side {
  return e.side === 'them' ? 'them' : 'us';
}

export function rosterOf(g: Game, side: Side): Player[] {
  return side === 'them' ? g.oppRoster : g.roster;
}

export function homeSide(g: Game): Side {
  return g.info.homeAway === 'home' ? 'us' : 'them';
}

export function sideName(g: Game, side: Side): 'Home' | 'Away' {
  return side === homeSide(g) ? 'Home' : 'Away';
}

/** Adds a player to one side's roster; throws if that side already has the jersey number. */
export function addPlayer(g: Game, side: Side, p: Player, now: Date): Game {
  const n = p.number.trim();
  if (rosterOf(g, side).some((q) => q.number.trim() === n)) throw new Error(`Duplicate number: #${n}.`);
  const key = side === 'them' ? 'oppRoster' : 'roster';
  return { ...g, [key]: [...rosterOf(g, side), p], updatedAt: now.toISOString() };
}

function withEvents(g: Game, events: GameEvent[], now: Date): Game {
  return { ...g, events, updatedAt: now.toISOString() };
}

export function newGame(info: GameInfo, roster: Player[], now: Date, oppRoster: Player[] = []): Game {
  const iso = now.toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    info,
    roster,
    oppRoster,
    events: [],
    currentPeriod: 1,
    periods: [],
    trackOpponentTaps: false,
    createdAt: iso,
    updatedAt: iso,
  };
}

function makeEvent(d: EventDraft, order: number, period: number, now: Date): GameEvent {
  const { period: _ignored, ...rest } = d;
  return { ...rest, id: crypto.randomUUID(), order, period, enteredAt: now.toISOString() };
}

/**
 * Orders for `count` plays or subs that belong in `period`: after the last of `others` (plays and subs,
 * by order) whose period is `period` or earlier, and before the play or sub that follows it. With nothing
 * after, they count up from the last order; with nothing at or before `period`, they go before the first.
 */
export function slotOrders(others: { order: number; period: number }[], period: number, count: number): number[] {
  const sorted = [...others].sort((a, b) => a.order - b.order);
  const steps = Array.from({ length: count }, (_, i) => i + 1);
  if (sorted.length === 0) return steps.map((i) => i - 1);
  let last = -1;
  for (let i = 0; i < sorted.length; i++) if (sorted[i].period <= period) last = i;
  if (last < 0) return steps.map((i) => sorted[0].order - (count + 1 - i));
  const lo = sorted[last].order;
  const next = sorted[last + 1];
  if (!next) return steps.map((i) => lo + i);
  return steps.map((i) => lo + ((next.order - lo) * i) / (count + 1));
}

/** Adds a play at the end of its period, so a play added to an earlier quarter sorts with that quarter. */
export function appendEvent(g: Game, d: EventDraft, now: Date): Game {
  const period = d.period ?? g.currentPeriod;
  const [order] = slotOrders([...g.events, ...(g.subs ?? [])], period, 1);
  const e = makeEvent(d, order, period, now);
  return withEvents(g, [...g.events, e], now);
}

/** Records a substitution on one side, ordered among the plays after the last item of the current period. */
export function recordSub(g: Game, side: Side, ins: string[], outs: string[], now: Date): Game {
  if (ins.length === 0 && outs.length === 0) return g;
  const [order] = slotOrders([...g.events, ...(g.subs ?? [])], g.currentPeriod, 1);
  const s: Sub = { id: crypto.randomUUID(), side, ins, outs, order, period: g.currentPeriod, enteredAt: now.toISOString() };
  return { ...g, subs: [...(g.subs ?? []), s], updatedAt: now.toISOString() };
}

export function insertEventBefore(g: Game, beforeId: string, d: EventDraft, now: Date): Game {
  const sorted = orderedEvents(g);
  const idx = sorted.findIndex((e) => e.id === beforeId);
  if (idx < 0) throw new Error(`No event with id ${beforeId}`);
  const target = sorted[idx];
  // The nearest order below the target, among plays AND subs, so the new play never ties a sub.
  const below = [...sorted, ...(g.subs ?? [])].map((x) => x.order).filter((o) => o < target.order);
  const order = below.length === 0 ? target.order - 1 : (Math.max(...below) + target.order) / 2;
  const e = makeEvent(d, order, target.period, now);
  return withEvents(g, [...g.events, e], now);
}

export function editEvent(
  g: Game,
  id: string,
  patch: Partial<Pick<GameEvent, 'type' | 'playerId' | 'period' | 'timeoutKind' | 'oppPoints' | 'side'>>,
  now: Date,
): Game {
  const target = g.events.find((e) => e.id === id);
  // A changed period re-slots the play at the end of its new period.
  const moved = target && patch.period !== undefined && patch.period !== target.period;
  const order = moved ? slotOrders([...g.events.filter((e) => e.id !== id), ...(g.subs ?? [])], patch.period!, 1)[0] : undefined;
  return withEvents(
    g,
    g.events.map((e) =>
      e.id === id ? { ...e, ...patch, ...(order === undefined ? {} : { order }), editedAt: now.toISOString() } : e,
    ),
    now,
  );
}

export function deleteEvent(g: Game, id: string, now: Date): Game {
  return withEvents(g, g.events.filter((e) => e.id !== id), now);
}

// Sets `period` on fromId and on every later play or sub (by order) in the SAME original period as fromId; plays and subs in
// other periods stay. A sub inside the block happened among those plays, so it moves with them: left behind, it would split
// the earlier quarter from a play added to it later. Moving forward (the missed End Q) puts the moved items at the START of
// the target period, ahead of its own: one quarter on, they were already the tail of their period, so the order is left
// alone; past a quarter that has plays, they are re-slotted after the last item before the target period. Moving backward
// from mid-period would leave them after plays of a later period, so they are re-slotted, in their own order (a sub ahead of
// a play it tied, as the lineup replays them), at the END of the target period.
export function moveFrom(g: Game, fromId: string, period: number, now: Date): Game {
  const from = g.events.find((e) => e.id === fromId);
  if (!from) throw new Error(`No event with id ${fromId}`);
  const later = (x: { order: number; period: number }) => x.order > from.order && x.period === from.period;
  const inBlock = (e: GameEvent) => e.id === fromId || later(e);
  const subs = g.subs ?? [];
  const blockSubs = subs.filter(later);
  const others = [...g.events.filter((e) => !inBlock(e)), ...subs.filter((s) => !later(s))];
  const skipsPlays = others.some((e) => e.order > from.order && e.period > from.period && e.period < period);
  const behindLater = others.some((e) => e.order < from.order && e.period > period);
  const block: { id: string; order: number; sub: boolean }[] = [
    ...g.events.filter(inBlock).map((e) => ({ id: e.id, order: e.order, sub: false })),
    ...blockSubs.map((s) => ({ id: s.id, order: s.order, sub: true })),
  ].sort((a, b) => a.order - b.order || Number(b.sub) - Number(a.sub));
  const orders = skipsPlays
    ? slotOrders(others, period - 1, block.length)
    : behindLater
      ? slotOrders(others, period, block.length)
      : block.map((e) => e.order);
  const orderOf = new Map(block.map((e, i) => [e.id, orders[i]]));
  const move = <T extends { id: string }>(x: T): T => (orderOf.has(x.id) ? { ...x, period, order: orderOf.get(x.id)! } : x);
  const moved = withEvents(g, g.events.map(move), now);
  return blockSubs.length === 0 ? moved : { ...moved, subs: subs.map(move) };
}
