import { derive, oppPlaysRecorded, oppPointsRecorded } from '../core/derive';
import { periodLabel, spanLabel } from '../core/periods';
import { hoursUntilPurge } from '../core/storage';
import { checkPeriod, isExported, type PeriodCheck, type PeriodStatus } from '../core/reconcile';
import { sideName } from '../core/events';
import { statsGrid } from './stats-logic';
import type { ExportKind, Game, PeriodRecord, Side } from '../core/types';

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

/**
 * The Save toast: `Saved Q1 check`, or, when our score still disagrees with the book over the checked
 * span, the gap in the compare panel's words: `Saved Q1 check — app still 2 short`. A saved mismatch
 * read exactly like a match before 0.9.1.
 */
export function savedCheckText(bookTotal: number | null, c: Basis): string {
  const saved = `Saved ${periodLabel(c.period)} check`;
  if (bookTotal === null || !isMismatch(bookTotal, c)) return saved;
  const diff = bookTotal - c.anchorBook - c.appSpan;
  return `${saved} — app still ${Math.abs(diff)} ${way(diff)}`;
}

/**
 * The compare panel: its text and whether it reads as a match (green) or not (amber). Our score alone
 * sets the quarter's status, but a green "✓ Matches" over their score being off read as all clear, so
 * then the panel is amber: `Ours matches · theirs 1 off`. Null until our total is typed.
 */
export function comparePanel(
  bookTotal: number | null,
  c: Basis,
  theirs: { off: number } | null,
): { text: string; tone: 'match' | 'off' } | null {
  const text = compareText(bookTotal, c);
  if (text === null) return null;
  if (isMismatch(bookTotal, c)) return { text, tone: 'off' };
  if (!theirs || theirs.off === 0) return { text, tone: 'match' };
  const ours = text === '✓ Matches' ? 'Ours matches' : text.replace(/^✓ /, '');
  return { text: `${ours} · theirs ${theirs.off} off`, tone: 'off' };
}

export const MISMATCH_HINT = 'Add the missing play, fix one below, or write a note and Save.';

/**
 * The check screen's top line: the app's game score after the period, then the period's own points,
 * `App after Q2: Us 18 · Them 12 (Q2: 8–6)`. Them is left out until any of their points are recorded.
 */
export function appHasText(g: Game, period: number): string {
  const d = derive(g);
  const label = periodLabel(period);
  const us = d.usByPeriod[period] ?? 0;
  const usGame = cumulativeThrough(g, period);
  if (!oppPointsRecorded(g)) return `App after ${label}: Us ${usGame} (${label}: ${us})`;
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
 * Their half of the check, on game totals: the app's total is the last typed total of theirs plus
 * their points since. A blank box is not a book number, so it says nothing. It warns, never blocks:
 * the quarter's status follows our score alone.
 */
export type TheirScoreLine = { text: string; warn: boolean; off: number };
export function theirScoreLine(c: OppBasis & Pick<PeriodCheck, 'bookOppTotal'>): TheirScoreLine | null {
  if (c.bookOppTotal === null) return null;
  const app = c.anchorOppBook + c.oppTapped;
  const off = Math.abs(c.bookOppTotal - app);
  if (off === 0) return { text: `Their score: book ${c.bookOppTotal} · app ${app} ✓`, warn: false, off };
  return { text: `Their score: book ${c.bookOppTotal} · app ${app} — ${off} off`, warn: true, off };
}

/** The line for the typed total, or null when none of their points are recorded (nothing to compare). */
export function theirScoreLineIfRecorded(c: OppBasis, bookOppTotal: number | null, recorded: boolean): TheirScoreLine | null {
  return recorded ? theirScoreLine({ ...c, bookOppTotal }) : null;
}

/** Whose fouls the check lists, Home first: only ours with no record of the other team. */
export function foulSidesOf(g: Game): Side[] {
  if (!oppPlaysRecorded(g) && g.oppRoster.length === 0) return ['us'];
  return sideName(g, 'us') === 'Home' ? ['us', 'them'] : ['them', 'us'];
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

/** The More menu item that opens the quarter checks. */
export const QUARTER_CHECK_TEXT = 'Quarter checks';

/** The last period with a finished check screen: before the current one, or the current once the game ended. */
export function latestFinishedPeriod(g: Game): number {
  return g.endedAt ? g.currentPeriod : g.currentPeriod - 1;
}

/** Whether any quarter is finished, so the menu item shows. */
export function quarterChecksAvailable(g: Game): boolean {
  return latestFinishedPeriod(g) >= 1;
}

/** One tab per finished period, in order, toned like the Book chip: done (matched/fixed), off (unresolved), else plain. */
export function checkTabs(g: Game): { period: number; label: string; status: PeriodStatus; text: string; tone: 'done' | 'off' | 'plain' }[] {
  const last = latestFinishedPeriod(g);
  const tabs = [];
  for (let period = 1; period <= last; period++) {
    const { status } = checkPeriod(g, period);
    const tone = status === 'matched' || status === 'fixed' ? 'done' : status === 'unresolved' ? 'off' : 'plain';
    tabs.push({ period, label: periodLabel(period), status, text: statusChipText(status), tone } as const);
  }
  return tabs.map((t) => ({ ...t }));
}

export function playersHeading(period: number): string {
  return `Players in ${periodLabel(period)} (compare with the book)`;
}

/** One team's players for a quarter, to compare with the book: that quarter's points and fouls, and the game's fouls. */
export function quarterPlayerRows(
  g: Game, side: Side, period: number,
): { key: string; who: string; pts: number; fouls: number; gameFouls: number }[] {
  const grid = statsGrid(g, side);
  const i = grid.periods.indexOf(period);
  return grid.rows.map((r) => ({
    key: r.key,
    who: r.player ? `#${r.player.number} ${r.player.name}`.trim() : 'No number',
    pts: i < 0 ? 0 : r.cells[i].points,
    fouls: i < 0 ? 0 : r.cells[i].fouls,
    gameFouls: r.fouls,
  }));
}
