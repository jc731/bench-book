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

export function appendEvent(g: Game, d: EventDraft, now: Date): Game {
  const order = g.events.length === 0 ? 0 : Math.max(...g.events.map((e) => e.order)) + 1;
  const e = makeEvent(d, order, d.period ?? g.currentPeriod, now);
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
  return withEvents(
    g,
    g.events.map((e) => (e.id === id ? { ...e, ...patch, editedAt: now.toISOString() } : e)),
    now,
  );
}

export function deleteEvent(g: Game, id: string, now: Date): Game {
  return withEvents(g, g.events.filter((e) => e.id !== id), now);
}

// Sets `period` on fromId and on every later event (by order) in the SAME original period as fromId; plays in other periods stay.
export function moveFrom(g: Game, fromId: string, period: number, now: Date): Game {
  const from = g.events.find((e) => e.id === fromId);
  if (!from) throw new Error(`No event with id ${fromId}`);
  return withEvents(
    g,
    g.events.map((e) =>
      e.id === fromId || (e.order > from.order && e.period === from.period) ? { ...e, period } : e,
    ),
    now,
  );
}
