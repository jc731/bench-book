import { periodLabel } from '../core/periods';
import type { Derived } from '../core/derive';
import { BONUS_TEXT, teamFoulsWarn, timeoutsText } from './live-logic';

interface Props {
  us: number;
  opp: number;
  period: number;
  derived: Derived;
}

// Everything here must fit 390px without wrapping: line 1 is score, period and team fouls; line 2 is
// timeouts left and, once the opponent is in the bonus, the bonus pill.
export function StatusStrip({ us, opp, period, derived }: Props) {
  const fouls = derived.teamFoulsForBonus(period);
  return (
    <header class="sticky top-0 z-10 border-b border-slate-700 bg-slate-950 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-baseline gap-1 text-3xl font-bold tabular-nums" aria-label={`Score ${us} to ${opp}`}>
          <span class="text-xs font-semibold text-slate-400">Us</span>
          {us}–{opp}
          <span class="text-xs font-semibold text-slate-400">Them</span>
        </div>
        <div class="text-xl font-bold">{periodLabel(period)}</div>
        <div class={`text-base font-semibold ${teamFoulsWarn(fouls) ? 'text-amber-300' : ''}`}>Team fouls {fouls}</div>
      </div>
      <div class="mt-1 flex items-center justify-between gap-2 text-sm text-slate-300">
        <span class="whitespace-nowrap">{timeoutsText(derived.timeouts, period)}</span>
        {derived.oppInBonus(period) && (
          <span class="whitespace-nowrap rounded bg-amber-400 px-2 text-xs font-bold leading-5 text-slate-900">{BONUS_TEXT}</span>
        )}
      </div>
    </header>
  );
}
