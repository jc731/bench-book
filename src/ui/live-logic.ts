import { periodLabel } from '../core/periods';
import type { PeriodCheck } from '../core/reconcile';
import type { EventType, Player, TimeoutKind } from '../core/types';

export type PlayType = Extract<EventType, 'FG2' | 'FG3' | 'FTM' | 'FTX' | 'FOUL' | 'TECH'>;

const PLAY_TEXT: Record<PlayType, string> = {
  FG2: '+2',
  FG3: '+3',
  FTM: 'FT made',
  FTX: 'FT missed',
  FOUL: 'Foul',
  TECH: 'Tech foul',
};

export const BENCH_TECH_TEXT = 'Bench tech';

const TIMEOUT_TEXT: Record<TimeoutKind, string> = { full: 'Full', thirty: '30', ot: 'OT' };

/** Feedback / undo label for a player entry, e.g. `#4 +2`. */
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

const left = (t: { used: number; total: number }): number => Math.max(0, t.total - t.used);

/** `TO left: Full 3 · 30s 2`, plus ` · OT 1` only in an OT period. Using a timeout is never blocked, so left never goes negative. */
export function timeoutsText(t: TimeoutsLeft, period: number): string {
  const parts = [`Full ${left(t.full)}`, `30s ${left(t.thirty)}`];
  if (period > 4) parts.push(`OT ${left(t.ot)}`);
  return `TO left: ${parts.join(' · ')}`;
}

/** Team fouls this many short of the bonus turn amber: the IESA bonus starts on the 5th, so amber from 4. */
export const BONUS_AT = 5;
export function teamFoulsWarn(fouls: number): boolean {
  return fouls >= BONUS_AT - 1;
}

export const BONUS_TEXT = 'Bonus: they shoot FTs';

/** Screen-reader text for a card: `1 point`, `2 points`; `1 foul`, `3 fouls`. */
export function countText(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface FoulContext {
  /** The player's fouls (FOUL + TECH) and techs before this entry; null for a bench tech. */
  player: { p: Player; fouls: number; techs: number } | null;
  /** Team fouls toward the bonus before this entry. */
  teamFouls: number;
}

/**
 * The toast for a foul entry. The one that puts a player out names them: `#22 Player One foul — 5th, out`
 * (or `tech foul — 2nd tech, out`), and the one that puts the opponent in the bonus adds ` — bonus`.
 */
export function foulLabel(type: 'FOUL' | 'TECH' | 'BENCH_TECH', ctx: FoulContext): string {
  let label: string;
  if (type === 'BENCH_TECH' || !ctx.player) {
    label = BENCH_TECH_TEXT;
  } else {
    const { p, fouls, techs } = ctx.player;
    const who = `#${p.number} ${p.name}`.trim();
    const kind = type === 'TECH' ? 'tech foul' : 'foul';
    const out = fouls + 1 === 5 ? '5th, out' : type === 'TECH' && techs + 1 === 2 ? '2nd tech, out' : null;
    label = out ? `${who} ${kind} — ${out}` : playLabel(type, p.number);
  }
  return ctx.teamFouls + 1 === BONUS_AT ? `${label} — bonus` : label;
}

export interface EndChoices {
  overtime: string;
  endGame: string;
  /** The parenthetical half of endGame, drawn smaller on its own line so the button keeps its height. */
  endGameMain: string;
  endGameNote: string;
}

/** The End Q4 / End OT sheet's two choices. */
export function endChoices(period: number): EndChoices {
  const note = period > 4 ? '(no more overtime)' : '(no overtime)';
  return { overtime: 'Start overtime', endGame: `End game ${note}`, endGameMain: 'End game', endGameNote: note };
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
      ? `Check ${label} — doesn't match the book`
      : `Check ${label} — not checked against the book`;
  return { period: oldest.period, text };
}

/** What was just entered or undone; `canUndo` is false for facts (a file was saved) and after an undo. */
export type Toast = { text: string; canUndo: boolean };

/** The prompt chip on the feedback line: `chip` is what it shows, `text` the full prompt (its accessible name). */
export type Prompt =
  | { kind: 'check'; period: number; text: string; chip: string }
  | { kind: 'export'; text: string; chip: string };

/**
 * The one feedback line on Live, Log and the check: the last entry on the left, a prompt chip on the
 * right. Neither hides the other, so deferring a check never hides what was just tapped.
 */
export type Feedback = { entry: { text: string; undoable: boolean } | null; prompt: Prompt | null };

export const NOT_EXPORTED_CHIP = 'Not exported';

/** The line's two parts. The chip is the check prompt, else the not-exported warning. */
export function feedbackLine(banner: Banner | null, unexported: string | null, toast: Toast | null): Feedback {
  const entry = toast ? { text: toast.text, undoable: toast.canUndo } : null;
  const prompt: Prompt | null = banner
    ? { kind: 'check', period: banner.period, text: banner.text, chip: `Check ${periodLabel(banner.period)}` }
    : unexported
      ? { kind: 'export', text: unexported, chip: NOT_EXPORTED_CHIP }
      : null;
  return { entry, prompt };
}

export const UNDO_CLEARED_LABEL = 'Undo (history clears when the app reloads — fix plays in Log)';

/** The Undo button's accessible name when it says more than its text: disabled with plays on the board. */
export function undoAriaLabel(canUndo: boolean, hasEvents: boolean): string | undefined {
  return !canUndo && hasEvents ? UNDO_CLEARED_LABEL : undefined;
}
