// period 1..4 = Q1..Q4, 5 = OT1, 6 = OT2, ...
export function isOvertime(p: number): boolean {
  return p > 4;
}

export function otCount(p: number): number {
  return Math.max(0, p - 4);
}

export function periodLabel(p: number): string {
  return isOvertime(p) ? `OT${otCount(p)}` : `Q${p}`;
}

/** `Q2`, or `Q2–Q3` for a span of periods. */
export function spanLabel(from: number, to: number): string {
  return from >= to ? periodLabel(to) : `${periodLabel(from)}–${periodLabel(to)}`;
}
