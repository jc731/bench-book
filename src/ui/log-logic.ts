import { periodLabel } from '../core/periods';
import { orderedEvents } from '../core/events';
import type { EventType, Game, GameEvent, TimeoutKind } from '../core/types';
import { oppLabel, playLabel, timeoutLabel, type PlayType } from './live-logic';

export const PLAY_TYPES: PlayType[] = ['FG2', 'FG3', 'FTM', 'FTX', 'FOUL', 'TECH'];
const TIMEOUT_KINDS: TimeoutKind[] = ['full', 'thirty', 'ot'];

export function isPlayType(t: EventType): t is PlayType {
  return (PLAY_TYPES as EventType[]).includes(t);
}

/** Short label, no name: `#4 +2`, `Opp +3`, `Timeout (Full)`, `Bench T`. Used in toasts. */
export function eventLabel(g: Game, e: GameEvent): string {
  if (e.type === 'BENCH_TECH') return 'Bench T';
  if (e.type === 'TIMEOUT') return timeoutLabel(e.timeoutKind ?? 'full');
  if (e.type === 'OPP_PTS') return oppLabel(e.oppPoints ?? 2);
  const number = g.roster.find((p) => p.id === e.playerId)?.number ?? '?';
  return playLabel(e.type as PlayType, number);
}

/** Log row text: `#4 Player One · +2`; the name is dropped when blank. */
export function eventRowText(g: Game, e: GameEvent): string {
  if (!isPlayType(e.type)) return eventLabel(g, e);
  const p = g.roster.find((x) => x.id === e.playerId);
  const who = p ? `#${p.number} ${p.name}`.trim() : '#?';
  return `${who} · ${eventLabel(g, e).replace(/^#\S+ /, '')}`;
}

export interface PeriodGroup {
  period: number;
  events: GameEvent[];
}

/** Newest period first, events in `order` within a period; `period` filters to one. Empty periods are omitted. */
export function groupByPeriod(g: Game, period?: number): PeriodGroup[] {
  const by = new Map<number, GameEvent[]>();
  for (const e of orderedEvents(g)) {
    if (period !== undefined && e.period !== period) continue;
    by.set(e.period, [...(by.get(e.period) ?? []), e]);
  }
  return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([p, events]) => ({ period: p, events }));
}

/** Types an event may switch to without gaining or losing fields. */
export function compatibleTypes(e: GameEvent): EventType[] {
  return isPlayType(e.type) ? PLAY_TYPES : [e.type];
}

export function timeoutKindsFor(e: GameEvent): TimeoutKind[] {
  return e.type === 'TIMEOUT' ? TIMEOUT_KINDS : [];
}

export interface EditDraft {
  type: EventType;
  playerId?: string;
  period: number;
  timeoutKind?: TimeoutKind;
  oppPoints?: 1 | 2 | 3;
}

export function draftOf(e: GameEvent): EditDraft {
  return { type: e.type, playerId: e.playerId, period: e.period, timeoutKind: e.timeoutKind, oppPoints: e.oppPoints };
}

export type EditPatch = Partial<Pick<GameEvent, 'type' | 'playerId' | 'period' | 'timeoutKind' | 'oppPoints'>>;

/**
 * The fields that differ from the event, plus an explicit `undefined` for any field the final
 * type does not use and the event still carries, so no stale field survives a type change.
 */
export function editPatch(e: GameEvent, d: EditDraft): EditPatch {
  const patch: EditPatch = {};
  if (d.type !== e.type) patch.type = d.type;
  if (d.period !== e.period) patch.period = d.period;
  const player = isPlayType(d.type);
  if (player) {
    if (d.playerId !== e.playerId) patch.playerId = d.playerId;
  } else if (e.playerId !== undefined) patch.playerId = undefined;
  if (d.type === 'TIMEOUT') {
    if (d.timeoutKind !== e.timeoutKind) patch.timeoutKind = d.timeoutKind;
  } else if (e.timeoutKind !== undefined) patch.timeoutKind = undefined;
  if (d.type === 'OPP_PTS') {
    if (d.oppPoints !== e.oppPoints) patch.oppPoints = d.oppPoints;
  } else if (e.oppPoints !== undefined) patch.oppPoints = undefined;
  return patch;
}

/** Undo label for an edit: `Edited #4 +2 → +3`, or `Moved #4 +2 to Q2` when only the period changed. */
export function editLabel(g: Game, e: GameEvent, patch: EditPatch): string {
  const after = { ...e, ...patch };
  const before = eventLabel(g, e);
  const now = eventLabel(g, after);
  const moved = patch.period !== undefined && patch.period !== e.period;
  if (before === now) return moved ? `Moved ${before} to ${periodLabel(after.period)}` : `Edited ${before}`;
  const who = before.startsWith('#') ? before.split(' ')[0] + ' ' : null;
  const text = `Edited ${before} → ${who && now.startsWith(who) ? now.slice(who.length) : now}`;
  return moved ? `${text}, now in ${periodLabel(after.period)}` : text;
}

/** For "this and everything after": the period before and after the event's own, within 1..currentPeriod. */
export function moveFromTargets(g: Game, e: GameEvent): number[] {
  return [e.period - 1, e.period + 1].filter((p) => p >= 1 && p <= g.currentPeriod);
}

/** How many events `moveFrom` would touch. */
export function moveFromCount(g: Game, fromId: string): number {
  const from = g.events.find((e) => e.id === fromId);
  if (!from) return 0;
  return g.events.filter((e) => e.id === fromId || (e.order > from.order && e.period >= from.period)).length;
}

export function moveFromLabel(count: number, period: number): string {
  return `Moved ${count} ${count === 1 ? 'play' : 'plays'} to ${periodLabel(period)}`;
}

export function insertLabel(type: PlayType, number: string, period: number): string {
  return `Inserted ${playLabel(type, number)} in ${periodLabel(period)}`;
}
