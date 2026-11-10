import { periodLabel } from '../core/periods';
import type { PeriodCheck } from '../core/reconcile';
import type { EventType, TimeoutKind } from '../core/types';

export type PlayType = Extract<EventType, 'FG2' | 'FG3' | 'FTM' | 'FTX' | 'FOUL' | 'TECH'>;

const PLAY_TEXT: Record<PlayType, string> = {
  FG2: '+2',
  FG3: '+3',
  FTM: 'FT ✓',
  FTX: 'FT ✗',
  FOUL: 'Foul',
  TECH: 'Tech',
};

const TIMEOUT_TEXT: Record<TimeoutKind, string> = { full: 'Full', thirty: '30', ot: 'OT' };

/** Toast / undo label for a player entry, e.g. `#4 +2`. */
export function playLabel(type: PlayType, number: string): string {
  return `#${number} ${PLAY_TEXT[type]}`;
}

export function playButtonText(type: PlayType): string {
  return PLAY_TEXT[type];
}

export function timeoutLabel(kind: TimeoutKind): string {
  return `Timeout (${TIMEOUT_TEXT[kind]})`;
}

export function timeoutKindText(kind: TimeoutKind): string {
  return TIMEOUT_TEXT[kind];
}

export function oppLabel(points: 1 | 2 | 3): string {
  return `Opp +${points}`;
}

export function endPeriodLabel(period: number): string {
  return `End ${periodLabel(period)}`;
}

/** Whether ending this period could end the game (after Q4 or any OT) rather than just advance. */
export function mayEndGame(period: number): boolean {
  return period >= 4;
}

export interface TimeoutsLeft {
  full: { used: number; total: number };
  thirty: { used: number; total: number };
  ot: { used: number; total: number };
}

const left = (t: { used: number; total: number }): string => `${Math.max(0, t.total - t.used)}/${t.total}`;

/** `Full 3/3 · 30 2/2`, plus ` · OT 1/1` only in an OT period. Using a timeout is never blocked, so left never goes negative. */
export function timeoutsText(t: TimeoutsLeft, period: number): string {
  const parts = [`Full ${left(t.full)}`, `30 ${left(t.thirty)}`];
  if (period > 4) parts.push(`OT ${left(t.ot)}`);
  return parts.join(' · ');
}

export interface Banner {
  period: number;
  text: string;
}

/** The reconcile banner: names the oldest period still pending or unresolved, or null when none. */
export function reconcileBanner(issues: PeriodCheck[]): Banner | null {
  if (issues.length === 0) return null;
  const oldest = issues.reduce((a, b) => (b.period < a.period ? b : a));
  const label = periodLabel(oldest.period);
  const text =
    oldest.status === 'unresolved'
      ? `${label} doesn't match the book — Check`
      : `${label} not checked against the book — Check`;
  return { period: oldest.period, text };
}
