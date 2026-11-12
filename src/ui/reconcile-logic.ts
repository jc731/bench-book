import { derive } from '../core/derive';
import { periodLabel, spanLabel } from '../core/periods';
import { hoursUntilPurge } from '../core/storage';
import { isExported, type PeriodCheck, type PeriodStatus } from '../core/reconcile';
import type { ExportKind, Game, PeriodRecord } from '../core/types';

/** The saved check's anchor values a live comparison needs (see `checkPeriod`). */
type Basis = Pick<PeriodCheck, 'period' | 'spanFrom' | 'anchorBook' | 'anchorApp' | 'appTotal' | 'appSpan'>;

const way = (n: number) => (n > 0 ? 'short' : 'over');

/**
 * The live comparison for a typed game total, or null until one is typed. It leads with the totals the
 * scorer can see, and grades the quarter's own points: a gap carried from an earlier noted quarter is
 * named, not counted again.
 * `✓ Matches` · `✓ Q2 matches — app still 2 short from Q1` · `Book 20 · App 16 — app is 2 short in Q2`.
 */
export function compareText(bookTotal: number | null, c: Basis): string | null {
  if (bookTotal === null) return null;
  const span = spanLabel(c.spanFrom, c.period);
  const diff = bookTotal - c.anchorBook - c.appSpan;
  const carried = c.anchorBook - c.anchorApp;
  const from = periodLabel(c.spanFrom - 1);
  if (diff === 0) return carried === 0 ? '✓ Matches' : `✓ ${span} matches — app still ${Math.abs(carried)} ${way(carried)} from ${from}`;
  const tail = carried === 0 ? '' : ` (already ${Math.abs(carried)} ${way(carried)} after ${from})`;
  return `Book ${bookTotal} · App ${c.appTotal} — app is ${Math.abs(diff)} ${way(diff)} in ${span}${tail}`;
}

/** Whether a typed total disagrees with the app over the checked span. */
export function isMismatch(bookTotal: number | null, c: Basis): boolean {
  return bookTotal !== null && bookTotal - c.anchorBook !== c.appSpan;
}

export const MISMATCH_HINT = 'Add the missing play, fix one below, or write a note and Save.';

/**
 * The check screen's top line: the app's game score after the period, then the period's own points,
 * `App after Q2: Us 18 · Them 12 (Q2: 8–6)`. Them is the opponent taps, so it is left out when taps are off.
 */
export function appHasText(g: Game, period: number): string {
  const d = derive(g);
  const label = periodLabel(period);
  const us = d.usByPeriod[period] ?? 0;
  const usGame = cumulativeThrough(g, period);
  if (!g.trackOpponentTaps) return `App after ${label}: Us ${usGame} (${label}: ${us})`;
  let oppGame = 0;
  for (const [p, pts] of Object.entries(d.oppByPeriod)) if (Number(p) <= period) oppGame += pts;
  return `App after ${label}: Us ${usGame} · Them ${oppGame} (${label}: ${us}–${d.oppByPeriod[period] ?? 0})`;
}

export { sawMismatch } from '../core/drafts';

/** Our points from the opening tip through the end of `period`. */
export function cumulativeThrough(g: Game, period: number): number {
  const by = derive(g).usByPeriod;
  let total = 0;
  for (const [p, pts] of Object.entries(by)) if (Number(p) <= period) total += pts;
  return total;
}

export function statusChipText(status: PeriodStatus): string {
  return { pending: 'Not checked', matched: '✓ Matched', fixed: '✓ Fixed', noted: 'Noted', unresolved: 'Mismatch' }[status];
}

/** The Final screen's button for an open quarter: a quarter never checked is checked, not reopened. */
export function issueAction(status: PeriodStatus): 'Check' | 'Reopen' {
  return status === 'pending' ? 'Check' : 'Reopen';
}

export type ParsedScore = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

/** Empty means not entered; only whole non-negative numbers are accepted. */
export function parseScore(text: string): ParsedScore {
  const t = text.trim();
  if (t === '') return { kind: 'empty' };
  if (!/^\d{1,3}$/.test(t)) return { kind: 'invalid' };
  return { kind: 'ok', value: Number(t) };
}

type OppBasis = Pick<PeriodCheck, 'period' | 'oppSpanFrom' | 'anchorOppBook' | 'oppTapped'>;

/**
 * The opponent half of the check, on game totals: the taps' total is the last typed opponent total
 * plus the taps since. A blank box is not a book number, so it is never compared and never reads as a
 * match. Null when there is nothing to say (taps off and the box blank).
 */
export function oppCompareText(bookOppTotal: number | null, c: OppBasis, tracking: boolean): string | null {
  if (bookOppTotal === null) return tracking ? 'Opponent not compared (box blank)' : null;
  if (!tracking) return `Opponent ${bookOppTotal} from the book (no taps to compare)`;
  const taps = c.anchorOppBook + c.oppTapped;
  if (bookOppTotal === taps) return `Opponent: book ${bookOppTotal} · taps ${taps} ✓`;
  const diff = bookOppTotal - taps;
  return `Opponent: book ${bookOppTotal} · taps ${taps} — taps are ${Math.abs(diff)} ${way(diff)} in ${spanLabel(c.oppSpanFrom, c.period)}`;
}

/** Placeholder for the opponent box: the taps' game total as a hint, never as a value. */
export function oppPlaceholder(c: OppBasis, tracking: boolean): string {
  return tracking ? `${c.anchorOppBook + c.oppTapped} from taps` : '';
}

export const EXPORT_NAME: Record<ExportKind, string> = { book: 'Book CSV', plays: 'Plays CSV' };
export const EXPORT_DESCRIPTION: Record<ExportKind, string> = {
  book: 'Box score: running score, points, fouls, timeouts',
  plays: 'Every play in order',
};

/** `Book CSV ✓ saved` or `Plays CSV — not saved yet`. */
export function exportStateText(g: Game, kind: ExportKind): string {
  return g.exported?.[kind] ? `${EXPORT_NAME[kind]} ✓ saved` : `${EXPORT_NAME[kind]} — not saved yet`;
}

/** The warning shown on Live and Setup once the game ended but not both files were exported. */
export function notExportedText(g: Game, now: Date): string | null {
  if (!g.endedAt || isExported(g)) return null;
  return `Not exported — game data clears in ${Math.ceil(hoursUntilPurge(g, now))} h`;
}

/** Game totals as typed from the book. */
export interface ReconcileDraft {
  bookUsTotal: number | null;
  /** Only what the scorer typed; the box is never prefilled, so blank means no book number. */
  bookOppTotal: number | null;
  note: string;
}

/** What to write for this draft, or null when it changes nothing (so no undo step and no toast). */
export function reconcileDraftToSave(
  saved: PeriodRecord | undefined,
  d: ReconcileDraft,
): ReconcileDraft | null {
  const rec = { bookUsTotal: d.bookUsTotal, bookOppTotal: d.bookOppTotal, note: d.note };
  const before = { bookUsTotal: saved?.bookUsTotal ?? null, bookOppTotal: saved?.bookOppTotal ?? null, note: saved?.note ?? '' };
  const same = rec.bookUsTotal === before.bookUsTotal && rec.bookOppTotal === before.bookOppTotal && rec.note === before.note;
  return same ? null : rec;
}
