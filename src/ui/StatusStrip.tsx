import { bonusText, stripPeriodText, type TeamTag } from './live-logic';

interface Props {
  home: number;
  away: number;
  period: number;
  /** An ended game shows `Final` in place of the period. */
  ended: boolean;
  /** Which teams shoot free throws in the bonus: each badge sits over its own half. */
  shooters: { home: boolean; away: boolean };
}

const badge = (tag: TeamTag) => (
  <span class="whitespace-nowrap rounded bg-amber-400 px-2 text-xs font-bold leading-5 text-slate-900">{bonusText(tag)}</span>
);

// One line that must fit 390px without wrapping: Home's bonus badge over the Home half, the score
// (home–away) and the period in the middle, Away's badge over the Away half. Each half's own header
// carries its team fouls, and its timeout buttons say what is left.
export function StatusStrip({ home, away, period, ended, shooters }: Props) {
  return (
    <header class="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-700 bg-slate-950 px-2 py-1">
      <div class="flex justify-start">{shooters.home && badge('Home')}</div>
      <div class="flex items-baseline gap-2">
        <div class="text-3xl font-bold tabular-nums" aria-label={`Score Home ${home}, Away ${away}`}>
          {home}–{away}
        </div>
        <div class="text-xl font-bold">{stripPeriodText(period, ended)}</div>
      </div>
      <div class="flex justify-end">{shooters.away && badge('Away')}</div>
    </header>
  );
}
