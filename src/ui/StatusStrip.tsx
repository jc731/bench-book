import { periodLabel } from '../core/periods';
import type { Derived } from '../core/derive';
import { timeoutsText } from './live-logic';

interface Props {
  us: number;
  opp: number;
  period: number;
  derived: Derived;
}

export function StatusStrip({ us, opp, period, derived }: Props) {
  const fouls = derived.teamFoulsForBonus(period);
  return (
    <header class="sticky top-0 z-10 border-b border-slate-700 bg-slate-950 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="text-3xl font-bold tabular-nums" aria-label={`Score ${us} to ${opp}`}>
          {us}–{opp}
        </div>
        <div class="text-xl font-bold">{periodLabel(period)}</div>
        <div class="flex items-center gap-2 text-base font-semibold">
          <span>Fouls {fouls}</span>
          {derived.oppInBonus(period) && (
            <span class="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">OPP IN BONUS</span>
          )}
        </div>
      </div>
      <div class="mt-1 text-sm text-slate-300">{timeoutsText(derived.timeouts, period)}</div>
    </header>
  );
}
