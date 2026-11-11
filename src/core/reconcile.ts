import { derive } from './derive';
import type { ExportKind, Game, PeriodRecord } from './types';

export type PeriodStatus = 'pending' | 'matched' | 'fixed' | 'noted' | 'unresolved';

export interface PeriodCheck {
  period: number;
  appUs: number;
  bookUs: number | null;
  diff: number | null; // bookUs - appUs
  bookOpp: number | null;
  oppTapped: number;
  status: PeriodStatus;
  note: string;
}

function touch(g: Game, now: Date): Game {
  return { ...g, updatedAt: now.toISOString() };
}

// Status is derived from the live event log each time; only `hadMismatch` is remembered.
export function checkPeriod(g: Game, period: number): PeriodCheck {
  const d = derive(g);
  const rec = g.periods.find((p) => p.period === period);
  const appUs = d.usByPeriod[period] ?? 0;
  const bookUs = rec?.bookUs ?? null;
  const note = rec?.note ?? '';
  const hasNote = note.trim() !== '';
  let status: PeriodStatus;
  if (bookUs === null) status = hasNote ? 'noted' : 'pending';
  else if (bookUs === appUs) status = rec?.hadMismatch ? 'fixed' : 'matched';
  else status = hasNote ? 'noted' : 'unresolved';
  return {
    period, appUs, bookUs, diff: bookUs === null ? null : bookUs - appUs,
    bookOpp: rec?.bookOpp ?? null, oppTapped: d.oppByPeriod[period] ?? 0, status, note,
  };
}

export function endPeriod(g: Game, now: Date): Game {
  return { ...touch(g, now), currentPeriod: g.currentPeriod + 1 };
}

/** Start overtime; also undoes a mistaken End game, since the game is no longer over. */
export function startOvertime(g: Game, now: Date): Game {
  const { endedAt: _ended, ...open } = g;
  return endPeriod(open, now);
}

export function saveReconcile(
  g: Game, period: number, bookUs: number | null, bookOpp: number | null, note: string, now: Date,
): Game {
  const appUs = derive(g).usByPeriod[period] ?? 0;
  const prev = g.periods.find((p) => p.period === period);
  const rec: PeriodRecord = {
    period, bookUs, bookOpp, note,
    hadMismatch: (prev?.hadMismatch ?? false) || (bookUs !== null && bookUs !== appUs),
  };
  const periods = prev ? g.periods.map((p) => (p === prev ? rec : p)) : [...g.periods, rec];
  return { ...touch(g, now), periods };
}

export function endGame(g: Game, now: Date): Game {
  return { ...touch(g, now), endedAt: now.toISOString() };
}

/** Records that one CSV was exported. Never blocks and is safe to repeat; refreshes updatedAt like every edit. */
export function markExported(g: Game, kind: ExportKind, now: Date): Game {
  return { ...touch(g, now), exported: { ...g.exported, [kind]: now.toISOString() } };
}

/** Exported means both files were saved: the Book CSV alone loses the plays, the Plays CSV alone the checks. */
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

export function oppTotal(g: Game): number {
  const d = derive(g);
  const booked = new Map(g.periods.map((p) => [p.period, p.bookOpp]));
  let total = 0;
  for (const [p, bookOpp] of booked) total += bookOpp ?? d.oppByPeriod[p] ?? 0;
  for (const [p, taps] of Object.entries(d.oppByPeriod)) {
    if (!booked.has(Number(p))) total += taps;
  }
  return total;
}
