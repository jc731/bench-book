import { periodLabel } from '../core/periods';
import type { Mark } from '../core/running';

export interface Cell {
  n: number;
  mark?: Mark['mark'];
  number?: string;
  /** Points a 2 or 3 jumped over: no mark of their own, shown with a light fill. */
  passedThrough: boolean;
  endsPeriod: boolean;
  periodLabel?: string;
}

export const ROW = 16;
const MIN_CELLS = 112;

/** Cells 1..max(112, last score), rounded up to a whole row of 16. */
export function buildCells(marks: Mark[]): Cell[] {
  const last = marks.length ? marks[marks.length - 1].score : 0;
  const total = Math.ceil(Math.max(MIN_CELLS, last) / ROW) * ROW;
  const byScore = new Map(marks.map((m) => [m.score, m]));
  const cells: Cell[] = [];
  for (let n = 1; n <= total; n++) {
    const m = byScore.get(n);
    if (m) {
      cells.push({
        n, mark: m.mark, number: m.number, passedThrough: false,
        endsPeriod: m.endsPeriod, periodLabel: m.endsPeriod ? periodLabel(m.period) : undefined,
      });
    } else {
      // Every score is a mark, so an unmarked cell below the last score was jumped over by a 2 or 3.
      cells.push({ n, passedThrough: n < last, endsPeriod: false });
    }
  }
  return cells;
}

/** One line under the Running score header, and the same words in the How-to's "Reading the screen". */
export const MARK_LEGEND =
  'X is a 2. ● is a 3. / is a made free throw. Shaded cells were skipped by a 2 or 3. An amber edge ends a quarter.';
