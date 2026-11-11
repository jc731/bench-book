import { periodLabel } from '../core/periods';
import { editEvent, moveFrom, orderedEvents } from '../core/events';
import type { EventType, Game, GameEvent, TimeoutKind } from '../core/types';
import { BENCH_TECH_TEXT, oppLabel, playLabel, timeoutLabel, type PlayType } from './live-logic';

export const PLAY_TYPES: PlayType[] = ['FG2', 'FG3', 'FTM', 'FTX', 'FOUL', 'TECH'];
const TIMEOUT_KINDS: TimeoutKind[] = ['full', 'thirty', 'ot'];

export function isPlayType(t: EventType): t is PlayType {
  return (PLAY_TYPES as EventType[]).includes(t);
}

/** Short label, no name: `#4 +2`, `Opp +3`, `Timeout (Full)`, `Bench tech`. Used in toasts. */
export function eventLabel(g: Game, e: GameEvent): string {
  if (e.type === 'BENCH_TECH') return BENCH_TECH_TEXT;
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

/**
 * Periods and the events within each, by `order`: `newest` (the Log) lists the newest period and the
 * newest play first; `oldest` (the quarter check, walked beside the book) lists both oldest first.
 * `period` filters to one. Empty periods are omitted.
 */
export function groupByPeriod(g: Game, period?: number, order: 'newest' | 'oldest' = 'newest'): PeriodGroup[] {
  const by = new Map<number, GameEvent[]>();
  const events = orderedEvents(g);
  if (order === 'newest') events.reverse();
  for (const e of events) {
    if (period !== undefined && e.period !== period) continue;
    by.set(e.period, [...(by.get(e.period) ?? []), e]);
  }
  const dir = order === 'newest' ? -1 : 1;
  return [...by.entries()].sort((a, b) => dir * (a[0] - b[0])).map(([p, events]) => ({ period: p, events }));
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

/** How many events `moveFrom` would touch: the play and every later play in its own period. */
export function moveFromCount(g: Game, fromId: string): number {
  const from = g.events.find((e) => e.id === fromId);
  if (!from) return 0;
  return g.events.filter((e) => e.id === fromId || (e.order > from.order && e.period === from.period)).length;
}

/** How many plays come after this one in its own quarter (what "Also move" adds); 0 when absent. */
export function followersCount(g: Game, id: string): number {
  return Math.max(0, moveFromCount(g, id) - 1);
}

export function playsCount(count: number): string {
  return `${count} ${count === 1 ? 'play' : 'plays'}`;
}

export function moveFromLabel(count: number, period: number): string {
  return `Moved ${playsCount(count)} to ${periodLabel(period)}`;
}

/** The checkbox in the fix sheet's Quarter group: `Also move the 3 plays after it in Q3`. */
export function alsoMoveText(after: number, period: number): string {
  return `Also move the ${playsCount(after)} after it in ${periodLabel(period)}`;
}

/** The fix sheet's title: `Fix: #12 +2 · Q1`. */
export function editTitle(g: Game, e: GameEvent): string {
  return `Fix: ${eventLabel(g, e)} · ${periodLabel(e.period)}`;
}

/**
 * What the fix sheet's Save does, as one update (so one undo step), or null when nothing changes.
 * With "Also move" ticked, a changed quarter takes the plays after it along (`moveFrom`); the other
 * fields are edited first, and the play is marked edited only when one of them changed.
 */
export function editSave(
  g: Game,
  e: GameEvent,
  d: EditDraft,
  alsoMove: boolean,
): { apply: (g: Game, now: Date) => Game; label: string } | null {
  const patch = editPatch(e, d);
  if (Object.keys(patch).length === 0) return null;
  const followers = followersCount(g, e.id);
  if (!alsoMove || followers === 0 || patch.period === undefined) {
    return { apply: (x, now) => editEvent(x, e.id, patch, now), label: editLabel(g, e, patch) };
  }
  const { period: _moved, ...rest } = patch;
  const to = d.period;
  const edited = Object.keys(rest).length > 0;
  return {
    apply: (x, now) => moveFrom(edited ? editEvent(x, e.id, rest, now) : x, e.id, to, now),
    label: edited
      ? `${editLabel(g, e, rest)}; moved ${playsCount(followers + 1)} to ${periodLabel(to)}`
      : moveFromLabel(followers + 1, to),
  };
}

export function addedLabel(type: PlayType, number: string, period: number): string {
  return `Added ${playLabel(type, number)} to ${periodLabel(period)}`;
}

/** The feedback line on reopening a game in progress: `Last: #3 +2`; null with no plays or once ended. */
export function resumeText(g: Game): string | null {
  if (g.endedAt || g.events.length === 0) return null;
  // The most recently entered play, which is where the scorer left off (a play added to an earlier quarter sorts earlier).
  const last = g.events.reduce((a, b) => (b.enteredAt > a.enteredAt || (b.enteredAt === a.enteredAt && b.order > a.order) ? b : a));
  return `Last: ${eventLabel(g, last)}`;
}
