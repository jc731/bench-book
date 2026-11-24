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

/** The clock closes itself this long after it reaches 0 (owner, 2026-11-24). */
export const CLOSE_AFTER_MS = 10_000;

export type ClockAlert = 'warn' | 'time';

/** Vibration patterns in ms: one buzz at the warning, a longer double at 0. */
export const BUZZ: Record<ClockAlert, number[]> = { warn: [300], time: [600, 200, 600] };

/**
 * The alert a running clock crossed between two reads, or null: 'time' when it reached 0, 'warn' when
 * it reached the warning point (D19). A paused clock crosses nothing; when both were crossed at once
 * (the phone slept through the warning), only 'time' is due.
 */
export function alertBetween(c: Clock, before: number, now: number): ClockAlert | null {
  if (c.endsAt === null || now <= before) return null;
  const a = clockLeftMs(c, before);
  const b = clockLeftMs(c, now);
  if (a > 0 && b === 0) return 'time';
  const warnAt = c.totalMs * WARN_FRACTION;
  return a > warnAt && b <= warnAt ? 'warn' : null;
}

/** A clock that ran out closes CLOSE_AFTER_MS later. A paused or reset one never closes by itself. */
export function closeDue(c: Clock, now: number): boolean {
  return c.endsAt !== null && now >= c.endsAt + CLOSE_AFTER_MS;
}
