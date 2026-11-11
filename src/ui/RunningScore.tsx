import { runningScore } from '../core/running';
import { MARK_LEGEND, ROW, buildCells } from './running-logic';
import type { GameStore } from './store';

// 16 cells must fit in 358px (390 minus padding): minmax(0,1fr) lets them shrink to ~22px,
// and the grid itself scrolls sideways if a narrower screen ever needs it — never the page.
export function RunningScore({ store }: { store: GameStore }) {
  const { game, setView } = store;
  const cells = game ? buildCells(runningScore(game)) : [];
  return (
    <main class="flex min-h-0 flex-1 flex-col">
      <header class="flex items-center gap-3 p-3">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 bg-slate-800 px-4 font-semibold" onClick={() => setView('live')}>
          Back
        </button>
        <h1 class="text-xl font-bold">Running score</h1>
      </header>
      <p class="px-4 pb-2 text-xs text-slate-300">{MARK_LEGEND}</p>
      <div class="min-h-0 flex-1 overflow-auto px-4 pb-4" data-testid="running-grid">
        <div class="grid min-w-[336px] gap-0" style={{ gridTemplateColumns: `repeat(${ROW}, minmax(0, 1fr))` }}>
          {cells.map((c) => (
            <div
              key={c.n}
              data-cell={c.n}
              class={`flex h-12 flex-col items-center justify-start border-b border-l border-slate-700 text-center leading-none ${
                c.passedThrough ? 'bg-slate-700' : 'bg-slate-800'
              } ${c.endsPeriod ? 'border-r-4 border-r-amber-400' : ''}`}
            >
              <span class="mt-0.5 text-[8px] text-slate-400">{c.n}</span>
              <span class="text-sm font-bold text-white">{c.mark ?? ''}</span>
              <span class="text-[9px] text-amber-200">{c.number ?? ''}</span>
              {c.periodLabel && <span class="text-[8px] font-semibold text-amber-400">{c.periodLabel}</span>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
