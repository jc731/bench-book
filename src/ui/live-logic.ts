import { periodLabel } from '../core/periods';
import type { PeriodCheck } from '../core/reconcile';
import type { TimeoutState } from '../core/derive';
import type { EventType, Player, TimeoutKind } from '../core/types';

export type TeamTag = 'Home' | 'Away';

export type PlayType = Extract<EventType, 'FG2' | 'FG3' | 'FTM' | 'FTX' | 'FOUL' | 'TECH'>;

const PLAY_TEXT: Record<PlayType, string> = {
  FG2: '+2',
  FG3: '+3',
  FTM: 'FT made',
  FTX: 'FT missed',
  FOUL: 'Foul',
  TECH: 'Tech foul',
};

/** The Bench sheet's button; the logged play reads `benchTechLabel(tag)`. */
export const BENCH_TECH_TEXT = 'Bench tech';
/** The Bench card's label: says it records techs, so it is not mistaken for roster editing. */
export const BENCH_CARD_TEXT = 'Bench / coach tech';

const TIMEOUT_TEXT: Record<TimeoutKind, string> = { full: 'Full', thirty: '30s', ot: 'OT' };

/** Who a play belongs to: `#4 (Home)`, `#14 (Away)`, or just `Away` with no player. */
export function who(p: Player | null, tag: TeamTag): string {
  return p ? `#${p.number} (${tag})` : tag;
}

/** The full name form: `#4 Player One (Home)`, `#14 (Away)` when unnamed, or just the tag with no player. */
export function namedWho(p: Player | null, tag: TeamTag): string {
  return p ? `${`#${p.number} ${p.name}`.trim()} (${tag})` : tag;
}

/** Feedback / undo label for a player entry, e.g. `#4 (Home) +2`. */
export function playLabel(type: PlayType, whoText: string): string {
  return `${whoText} ${PLAY_TEXT[type]}`;
}

export function benchTechLabel(tag: TeamTag): string {
  return `${tag} bench tech`;
}

export function playButtonText(type: PlayType): string {
  return PLAY_TEXT[type];
}

export function timeoutLabel(kind: TimeoutKind, tag: TeamTag): string {
  return `${tag} timeout (${TIMEOUT_TEXT[kind]})`;
}

export function timeoutsLeft(t: TimeoutState, kind: TimeoutKind): number {
  return t[kind].total - t[kind].used;
}

/** A timeout button: `Full: 2`. The display never goes below 0. */
export function timeoutButtonText(kind: TimeoutKind, left: number): string {
  return `${TIMEOUT_TEXT[kind]}: ${Math.max(0, left)}`;
}

const TIMEOUT_WORD: Record<TimeoutKind, string> = { full: 'full', thirty: '30-second', ot: 'OT' };

export function zeroTimeoutWarning(side: TeamTag, kind: TimeoutKind): string {
  return `${side} has no ${TIMEOUT_WORD[kind]} timeouts left. Are you sure?`;
}
export const TAKE_ANYWAY = 'Take one anyway';

export function timeoutKindText(kind: TimeoutKind): string {
  return TIMEOUT_TEXT[kind];
}

export function oppLabel(points: 1 | 2 | 3): string {
  return `Opp +${points}`;
}

export function endPeriodLabel(period: number): string {
  return `End ${periodLabel(period)}`;
}

/** The status strip's period: `Final` once the game has ended. */
export function stripPeriodText(period: number, ended: boolean): string {
  return ended ? 'Final' : periodLabel(period);
}

/** The bar's End slot: ends a quarter, opens the Q4/OT sheet that can end the game, or, once ended, opens Final. */
/** `mark` is decoration after the text, hidden from screen readers so it is not part of the button's name. */
/**
 * `tone` sets the button's color so the End slot stands apart from the rest of the bar: blue when it
 * ends a quarter, red when it can end the game (Q4 and OT), plain once the game is over.
 */
export type EndSlot = { text: string; mark?: string; opens: 'endPeriod' | 'endSheet' | 'final'; tone: 'quarter' | 'game' | 'final' };

export function endSlot(period: number, ended: boolean): EndSlot {
  if (ended) return { text: 'Final', mark: '▸', opens: 'final', tone: 'final' };
  // No "…": in the bar's narrow slot it wrapped to "End / Q4…" and read as a cut-off label (UX audit v0.6.0, F1).
  if (mayEndGame(period)) return { text: endPeriodLabel(period), opens: 'endSheet', tone: 'game' };
  return { text: endPeriodLabel(period), opens: 'endPeriod', tone: 'quarter' };
}

/** Whether ending this period could end the game (after Q4 or any OT) rather than just advance. */
export function mayEndGame(period: number): boolean {
  return period >= 4;
}

/** Team fouls this many short of the bonus turn amber: the IESA bonus starts on the 5th, so amber from 4. */
export const BONUS_AT = 5;
export function teamFoulsWarn(fouls: number): boolean {
  return fouls >= BONUS_AT - 1;
}

/** The strip's badge: the team that shoots free throws. */
export function bonusText(shooter: TeamTag): string {
  return `${shooter} shoots`;
}

/** Screen-reader text for a card: `1 point`, `2 points`; `1 foul`, `3 fouls`. */
export function countText(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface FoulContext {
  /** The player's fouls (FOUL + TECH) and techs before this entry; null for a bench tech or a foul with no number. */
  player: { p: Player; fouls: number; techs: number } | null;
  /** Team fouls toward the bonus before this entry. */
  teamFouls: number;
  /** The fouling team. */
  tag: TeamTag;
}

/**
 * The toast for a foul entry. The one that puts a player out names them: `#22 Player One (Home) foul — 5th, out`
 * (or `tech foul — 2nd tech, out`), and the one that puts the opponent in the bonus adds ` — bonus`.
 */
export function foulLabel(type: 'FOUL' | 'TECH' | 'BENCH_TECH', ctx: FoulContext): string {
  let label: string;
  if (type === 'BENCH_TECH') {
    label = benchTechLabel(ctx.tag);
  } else if (!ctx.player) {
    // A foul from + Play with no number: the team's, worded like any team play (`Away Foul`).
    label = playLabel(type, who(null, ctx.tag));
  } else {
    const { p, fouls, techs } = ctx.player;
    const named = namedWho(p, ctx.tag);
    const kind = type === 'TECH' ? 'tech foul' : 'foul';
    const out = fouls + 1 === 5 ? '5th, out' : type === 'TECH' && techs + 1 === 2 ? '2nd tech, out' : null;
    label = out ? `${named} ${kind} — ${out}` : playLabel(type, who(p, ctx.tag));
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

/**
 * What was just entered, undone or redone. `canUndo` is false for facts (a file was saved) and after an
 * undo; `canRedo` is true after an undo (or a redo with more left), until the next edit replaces the toast.
 */
export type Toast = { text: string; canUndo: boolean; canRedo?: boolean };

/** The prompt chip on the feedback line: `chip` is what it shows, `text` the full prompt (its accessible name). */
export type Prompt =
  | { kind: 'check'; period: number; text: string; chip: string }
  | { kind: 'export'; text: string; chip: string };

/**
 * The one feedback line on Live, Log and the check: the last entry on the left, a prompt chip on the
 * right. Neither hides the other, so deferring a check never hides what was just tapped.
 */
export type Feedback = { entry: { text: string; undoable: boolean; redoable: boolean } | null; prompt: Prompt | null };

export const NOT_EXPORTED_CHIP = 'Not exported';

/** The line's two parts. The chip is the check prompt, else the not-exported warning. */
export function feedbackLine(banner: Banner | null, unexported: string | null, toast: Toast | null): Feedback {
  const entry = toast ? { text: toast.text, undoable: toast.canUndo, redoable: Boolean(toast.canRedo) } : null;
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

/** Why a player is out, for the warning on their sheet: `5 fouls` or `2 techs`; null while they can play. */
export function outReason(line: { fouls: number; techs: number } | undefined): string | null {
  if (!line) return null;
  if (line.fouls >= 5) return `${line.fouls} fouls`;
  if (line.techs >= 2) return `${line.techs} techs`;
  return null;
}

export const OUT_WARNING = 'Are you sure? This player is supposed to be out.';
export const OUT_ANYWAY = 'Enter a play anyway';

/** The + Play prompt after the play: a number credits a player (added to the roster if new). */
export const WHOSE_NUMBER = 'Whose number?';
export const NO_NUMBER = 'No number';
export const STOP_ASKING = 'Stop asking this game';
