import { derive } from '../core/derive';
import { hoursUntilPurge } from '../core/storage';
import type { PeriodStatus } from '../core/reconcile';
import type { Game, PeriodRecord } from '../core/types';

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

/** The warning shown on Live and Setup once the game ended but nothing was exported. */
export function notExportedText(g: Game, now: Date): string | null {
  if (!g.endedAt || g.exportedAt) return null;
  return `Not exported — game data clears in ${Math.ceil(hoursUntilPurge(g, now))} h`;
}

export interface ReconcileDraft {
  bookUs: number | null;
  bookOpp: number | null;
  /** True once the scorer typed in the opponent field; an untouched prefill from taps is not a book number. */
  oppDirty: boolean;
  note: string;
}

/** What to write for this draft, or null when it changes nothing (so no undo step and no toast). */
export function reconcileDraftToSave(
  saved: PeriodRecord | undefined,
  d: ReconcileDraft,
): { bookUs: number | null; bookOpp: number | null; note: string } | null {
  const bookOpp = d.oppDirty ? d.bookOpp : (saved?.bookOpp ?? null);
  const rec = { bookUs: d.bookUs, bookOpp, note: d.note };
  const before = { bookUs: saved?.bookUs ?? null, bookOpp: saved?.bookOpp ?? null, note: saved?.note ?? '' };
  const same = rec.bookUs === before.bookUs && rec.bookOpp === before.bookOpp && rec.note === before.note;
  return same ? null : rec;
}
