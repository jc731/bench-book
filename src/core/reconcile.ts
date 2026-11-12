import { derive } from './derive';
import { periodLabel } from './periods';
import type { ExportKind, Game, PeriodRecord } from './types';

export type PeriodStatus = 'pending' | 'matched' | 'fixed' | 'noted' | 'unresolved';

/**
 * One period's check. The scorer types game totals (the book's running score); the comparison is over
 * the span since the last period that has a typed total (its "anchor", tip-off when none), so a gap
 * already noted in an earlier quarter does not make every later quarter read as a mismatch. The span is
 * usually just this period; it is wider only when an earlier check was skipped.
 */
export interface PeriodCheck {
  period: number;
  /** First period of the compared span (period itself unless earlier checks were skipped). */
  spanFrom: number;
  /** Our book total at the anchor (0 at tip-off), and the app's own total there. */
  anchorBook: number;
  anchorApp: number;
  bookTotal: number | null;
  appTotal: number;
  /** Points over the span: book = bookTotal − anchorBook, app = the plays recorded in it. */
  bookSpan: number | null;
  appSpan: number;
  diff: number | null; // bookSpan - appSpan
  /** The opponent the same way, with its own anchor; `oppTapped` is the taps over its span. */
  oppSpanFrom: number;
  anchorOppBook: number;
  bookOppTotal: number | null;
  bookOppSpan: number | null;
  oppTapped: number;
  status: PeriodStatus;
  note: string;
}

function touch(g: Game, now: Date): Game {
  return { ...g, updatedAt: now.toISOString() };
}

const sumOver = (by: Record<number, number>, from: number, to: number): number => {
  let t = 0;
  for (const [p, n] of Object.entries(by)) if (Number(p) >= from && Number(p) <= to) t += n;
  return t;
};

/** The latest period before `period` with a typed total for `key`, else tip-off (period 0, total 0). */
function anchorFor(g: Game, period: number, key: 'bookUsTotal' | 'bookOppTotal'): { period: number; total: number } {
  let best = { period: 0, total: 0 };
  for (const r of g.periods) {
    const v = r[key];
    if (v !== null && r.period < period && r.period > best.period) best = { period: r.period, total: v };
  }
  return best;
}

/** The nearest later period with a typed total for `key`, if any: a total may not exceed it. */
function nextTyped(g: Game, period: number, key: 'bookUsTotal' | 'bookOppTotal'): { period: number; total: number } | null {
  let best: { period: number; total: number } | null = null;
  for (const r of g.periods) {
    const v = r[key];
    if (v !== null && r.period > period && (!best || r.period < best.period)) best = { period: r.period, total: v };
  }
  return best;
}

// Status is derived from the live event log each time; only `hadMismatch` is remembered.
export function checkPeriod(g: Game, period: number): PeriodCheck {
  const d = derive(g);
  const rec = g.periods.find((p) => p.period === period);
  const us = anchorFor(g, period, 'bookUsTotal');
  const opp = anchorFor(g, period, 'bookOppTotal');
  const appSpan = sumOver(d.usByPeriod, us.period + 1, period);
  const bookTotal = rec?.bookUsTotal ?? null;
  const bookSpan = bookTotal === null ? null : bookTotal - us.total;
  const bookOppTotal = rec?.bookOppTotal ?? null;
  const note = rec?.note ?? '';
  const hasNote = note.trim() !== '';
  let status: PeriodStatus;
  if (bookSpan === null) status = hasNote ? 'noted' : 'pending';
  else if (bookSpan === appSpan) status = rec?.hadMismatch ? 'fixed' : 'matched';
  else status = hasNote ? 'noted' : 'unresolved';
  return {
    period, spanFrom: us.period + 1, anchorBook: us.total, anchorApp: sumOver(d.usByPeriod, 1, us.period),
    bookTotal, appTotal: sumOver(d.usByPeriod, 1, period), bookSpan, appSpan,
    diff: bookSpan === null ? null : bookSpan - appSpan,
    oppSpanFrom: opp.period + 1, anchorOppBook: opp.total, bookOppTotal,
    bookOppSpan: bookOppTotal === null ? null : bookOppTotal - opp.total,
    oppTapped: sumOver(d.oppByPeriod, opp.period + 1, period), status, note,
  };
}

/**
 * Why a typed game total cannot be right, or null: it is below an earlier period's typed total, or
 * above a later one's. Running totals never go down.
 */
export function totalProblem(g: Game, period: number, total: number | null, key: 'bookUsTotal' | 'bookOppTotal'): string | null {
  if (total === null) return null;
  const before = anchorFor(g, period, key);
  if (before.period > 0 && total < before.total) return `Lower than the ${before.total} saved after ${periodLabel(before.period)}`;
  const after = nextTyped(g, period, key);
  if (after && total > after.total) return `Higher than the ${after.total} saved after ${periodLabel(after.period)}`;
  return null;
}

export function endPeriod(g: Game, now: Date): Game {
  return { ...touch(g, now), currentPeriod: g.currentPeriod + 1 };
}

/** Start overtime; also undoes a mistaken End game, since the game is no longer over. */
export function startOvertime(g: Game, now: Date): Game {
  const { endedAt: _ended, ...open } = g;
  return endPeriod(open, now);
}

/**
 * Saves a check: game totals as typed from the book. `sawMismatch` says the book disagreed with the app
 * at some point before this save (the check screen fixed the plays first), so a period that matches now
 * still reads "fixed".
 */
export function saveReconcile(
  g: Game, period: number, bookUsTotal: number | null, bookOppTotal: number | null, note: string, now: Date,
  sawMismatch = false,
): Game {
  const prev = g.periods.find((p) => p.period === period);
  const draft: PeriodRecord = { period, bookUsTotal, bookOppTotal, note, hadMismatch: false };
  const without = g.periods.filter((p) => p !== prev);
  const after = checkPeriod({ ...g, periods: [...without, draft] }, period);
  const rec: PeriodRecord = {
    ...draft,
    hadMismatch: (prev?.hadMismatch ?? false) || sawMismatch || (after.diff !== null && after.diff !== 0),
  };
  const periods = prev ? g.periods.map((p) => (p === prev ? rec : p)) : [...g.periods, rec];
  // Saving a check retires the draft Later left for it.
  const { [period]: _draft, ...drafts } = g.checkDrafts ?? {};
  const checkDrafts = Object.keys(drafts).length ? drafts : undefined;
  return { ...touch(g, now), periods, checkDrafts };
}

export function endGame(g: Game, now: Date): Game {
  return { ...touch(g, now), endedAt: now.toISOString() };
}

/** Undoes End game, even after a reload: clears the end and goes back to the period it ended in. */
export function reopenGame(g: Game, now: Date): Game {
  if (!g.endedAt) return g;
  const { endedAt: _ended, ...open } = g;
  return touch(open, now);
}

/** Records that one CSV was exported. Never blocks and is safe to repeat; refreshes updatedAt like every edit. */
export function markExported(g: Game, kind: ExportKind, now: Date): Game {
  return { ...touch(g, now), exported: { ...g.exported, [kind]: now.toISOString() } };
}

/**
 * Exported means both files were saved since the last edit (an edit drops the marks): the Book CSV alone
 * loses the plays, the Plays CSV alone the checks.
 */
export function isExported(g: Game): boolean {
  return Boolean(g.exported?.book && g.exported?.plays);
}

export function openIssues(g: Game): PeriodCheck[] {
  const last = g.endedAt ? g.currentPeriod : g.currentPeriod - 1;
  const out: PeriodCheck[] = [];
  for (let p = 1; p <= last; p++) {
    const c = checkPeriod(g, p);
    if (c.status === 'pending' || c.status === 'unresolved') out.push(c);
  }
  return out;
}

/**
 * Their game score: the latest typed book total plus the taps after it (taps alone when none was
 * typed). Never runs backward, since a typed total replaces the taps up to it.
 */
export function oppTotal(g: Game): number {
  const last = anchorFor(g, Infinity, 'bookOppTotal');
  return last.total + sumOver(derive(g).oppByPeriod, last.period + 1, Infinity);
}
