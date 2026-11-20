import type { TimeoutKind } from '../core/types';

/**
 * The timeout clock (design 2026-11-19, D16-D19). Pure: every function takes `now`, so the clock is an
 * end time, not a ticking count (D18), and a view that was away reads the right time on return.
 */

/** D19: the warning shows once this share of the time is left. One constant, so "15 s on a full" is a one-line change. */
export const WARN_FRACTION = 0.5;

/** `endsAt` set means running; `leftMs` is what was left when it last stopped (or the full time). */
export interface Clock {
  kind: TimeoutKind;
  totalMs: number;
  endsAt: number | null;
  leftMs: number;
}

export type ClockPhase = 'ready' | 'running' | 'paused' | 'warn' | 'time';

/** D16: 60 s for a full or OT timeout, 30 s for a 30. D17: not running. */
export function newClock(kind: TimeoutKind): Clock {
  const totalMs = kind === 'thirty' ? 30_000 : 60_000;
  return { kind, totalMs, endsAt: null, leftMs: totalMs };
}

export function clockLeftMs(c: Clock, now: number): number {
  return Math.max(0, c.endsAt === null ? c.leftMs : c.endsAt - now);
}

export function startClock(c: Clock, now: number): Clock {
  return c.endsAt === null ? { ...c, endsAt: now + clockLeftMs(c, now) } : c;
}

export function pauseClock(c: Clock, now: number): Clock {
  return c.endsAt === null ? c : { ...c, endsAt: null, leftMs: clockLeftMs(c, now) };
}

export function resetClock(c: Clock): Clock {
  return { ...c, endsAt: null, leftMs: c.totalMs };
}

export function clockPhase(c: Clock, now: number): ClockPhase {
  const left = clockLeftMs(c, now);
  if (left === 0) return 'time';
  if (c.endsAt === null && left === c.totalMs) return 'ready';
  if (left <= c.totalMs * WARN_FRACTION) return 'warn';
  return c.endsAt === null ? 'paused' : 'running';
}

/** m:ss, rounding up to the whole second, as a game clock reads (59.001 s left is 1:00). */
export function clockText(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** D19: the note at the warning point, the time left then ("15 seconds" for a 30, "30 seconds" for a full). */
export function warnText(c: Clock): string {
  return `${Math.round((c.totalMs * WARN_FRACTION) / 1000)} seconds`;
}
