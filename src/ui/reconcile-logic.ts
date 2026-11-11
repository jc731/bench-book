import { derive } from '../core/derive';
import { hoursUntilPurge } from '../core/storage';
import { isExported, type PeriodStatus } from '../core/reconcile';
import type { ExportKind, Game, PeriodRecord } from '../core/types';

/** "Book 12 · App 10 — app is 2 short", "... app is 2 over", or "✓ Matches". Null until a book number exists. */
export function compareText(bookUs: number | null, appUs: number): string | null {
  if (bookUs === null) return null;
  if (bookUs === appUs) return '✓ Matches';
  const gap = Math.abs(bookUs - appUs);
  return `Book ${bookUs} · App ${appUs} — app is ${gap} ${bookUs > appUs ? 'short' : 'over'}`;
}

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

export type ParsedScore = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

/** Empty means not entered; only whole non-negative numbers are accepted. */
export function parseScore(text: string): ParsedScore {
  const t = text.trim();
  if (t === '') return { kind: 'empty' };
  if (!/^\d{1,3}$/.test(t)) return { kind: 'invalid' };
  return { kind: 'ok', value: Number(t) };
}

/**
 * The opponent half of the check. A blank box is not a book number, so it is never compared and
 * never reads as a match. Null when there is nothing to say (taps off and the box blank).
 */
export function oppCompareText(bookOpp: number | null, oppTapped: number, tracking: boolean): string | null {
  if (bookOpp === null) return tracking ? 'Opponent not compared (box blank)' : null;
  if (!tracking) return `Opponent ${bookOpp} from the book (no taps to compare)`;
  if (bookOpp === oppTapped) return `Opponent: book ${bookOpp} · taps ${oppTapped} ✓`;
  return `Opponent: book ${bookOpp} · taps ${oppTapped} — taps are ${Math.abs(bookOpp - oppTapped)} ${bookOpp > oppTapped ? 'short' : 'over'}`;
}

/** Placeholder for the opponent box: the tap total as a hint, never as a value. */
export function oppPlaceholder(oppTapped: number, tracking: boolean): string {
  return tracking ? `${oppTapped} from taps` : '';
}

export const EXPORT_NAME: Record<ExportKind, string> = { book: 'Book CSV', plays: 'Plays CSV' };
export const EXPORT_DESCRIPTION: Record<ExportKind, string> = {
  book: 'Box score: points, fouls, timeouts by quarter',
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

export interface ReconcileDraft {
  bookUs: number | null;
  /** Only what the scorer typed; the box is never prefilled, so blank means no book number. */
  bookOpp: number | null;
  note: string;
}

/** What to write for this draft, or null when it changes nothing (so no undo step and no toast). */
export function reconcileDraftToSave(
  saved: PeriodRecord | undefined,
  d: ReconcileDraft,
): { bookUs: number | null; bookOpp: number | null; note: string } | null {
  const rec = { bookUs: d.bookUs, bookOpp: d.bookOpp, note: d.note };
  const before = { bookUs: saved?.bookUs ?? null, bookOpp: saved?.bookOpp ?? null, note: saved?.note ?? '' };
  const same = rec.bookUs === before.bookUs && rec.bookOpp === before.bookOpp && rec.note === before.note;
  return same ? null : rec;
}
