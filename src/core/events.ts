import type { EventDraft, Game, GameEvent, GameInfo, Player } from './types';

export function orderedEvents(g: Game): GameEvent[] {
  return [...g.events].sort((a, b) => a.order - b.order);
}

function withEvents(g: Game, events: GameEvent[], now: Date): Game {
  return { ...g, events, updatedAt: now.toISOString() };
}

export function newGame(info: GameInfo, roster: Player[], now: Date): Game {
  const iso = now.toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    info,
    roster,
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
 * Orders for `count` events that belong in `period`: after the last of `others` (by order) whose
 * period is `period` or earlier, and before the event that follows it. With nothing after, they
 * count up from the last order; with nothing at or before `period`, they go before the first event.
 */
export function slotOrders(others: GameEvent[], period: number, count: number): number[] {
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
  const [order] = slotOrders(g.events, period, 1);
  const e = makeEvent(d, order, period, now);
  return withEvents(g, [...g.events, e], now);
}

export function insertEventBefore(g: Game, beforeId: string, d: EventDraft, now: Date): Game {
  const sorted = orderedEvents(g);
  const idx = sorted.findIndex((e) => e.id === beforeId);
  if (idx < 0) throw new Error(`No event with id ${beforeId}`);
  const target = sorted[idx];
  const order = idx === 0 ? target.order - 1 : (sorted[idx - 1].order + target.order) / 2;
  const e = makeEvent(d, order, target.period, now);
  return withEvents(g, [...g.events, e], now);
}

export function editEvent(
  g: Game,
  id: string,
  patch: Partial<Pick<GameEvent, 'type' | 'playerId' | 'period' | 'timeoutKind' | 'oppPoints'>>,
  now: Date,
): Game {
  const target = g.events.find((e) => e.id === id);
  // A changed period re-slots the play at the end of its new period.
  const moved = target && patch.period !== undefined && patch.period !== target.period;
  const order = moved ? slotOrders(g.events.filter((e) => e.id !== id), patch.period!, 1)[0] : undefined;
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

// Sets `period` on fromId and on every later event (by order) in the SAME original period as fromId; plays in other periods stay.
// Moving forward (the missed End Q) puts the moved plays at the START of the target period, ahead of its own plays: one
// quarter on, they were already the tail of their period, so the order is left alone; past a quarter that has plays,
// they are re-slotted after the last play before the target period. Moving backward from mid-period would leave them
// after plays of a later period, so they are re-slotted, in their own order, at the END of the target period.
export function moveFrom(g: Game, fromId: string, period: number, now: Date): Game {
  const from = g.events.find((e) => e.id === fromId);
  if (!from) throw new Error(`No event with id ${fromId}`);
  const inBlock = (e: GameEvent) => e.id === fromId || (e.order > from.order && e.period === from.period);
  const others = g.events.filter((e) => !inBlock(e));
  const skipsPlays = others.some((e) => e.order > from.order && e.period > from.period && e.period < period);
  const behindLater = others.some((e) => e.order < from.order && e.period > period);
  const block = g.events.filter(inBlock).sort((a, b) => a.order - b.order);
  const orders = skipsPlays
    ? slotOrders(others, period - 1, block.length)
    : behindLater
      ? slotOrders(others, period, block.length)
      : block.map((e) => e.order);
  const orderOf = new Map(block.map((e, i) => [e.id, orders[i]]));
  return withEvents(
    g,
    g.events.map((e) => (orderOf.has(e.id) ? { ...e, period, order: orderOf.get(e.id)! } : e)),
    now,
  );
}
