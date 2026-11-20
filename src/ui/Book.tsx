import { useState } from 'preact/hooks';
import { periodLabel } from '../core/periods';
import type { Game, Side } from '../core/types';
import { FeedbackLine } from './FeedbackLine';
import { feedbackLine } from './live-logic';
import { Log } from './Log';
import { StatusChip } from './Reconcile';
import { cellTappable, sideOrder, statsGrid, toggleText, totalText, type StatsCell, type StatsRow } from './stats-logic';
import type { GameStore } from './store';

export type BookTab = 'players' | 'plays';

// D1, D2: the tab and the team are kept until the app reloads, so they live in the module, not the view.
let keptTab: BookTab = 'players';
let keptSide: Side | null = null;

const segment = (selected: boolean) =>
  `min-h-11 flex-1 border px-3 font-semibold ${selected ? 'border-sky-400 bg-sky-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`;

/** The Book: Players (points and fouls by quarter, D1-D8) and Plays (the play list, unchanged). */
export function Book({ store }: { store: GameStore }) {
  const { game, toast, undo, redo, setView } = store;
  const [tab, setTabState] = useState<BookTab>(keptTab);
  const [pickedSide, setSideState] = useState<Side | null>(keptSide);
  if (!game) return null;
  const setTab = (t: BookTab) => setTabState((keptTab = t));
  const setSide = (s: Side) => setSideState((keptSide = s));
  const order = sideOrder(game);
  const side = pickedSide ?? order[0];

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={() => setView('live')}>
          Back
        </button>
        <h1 class="text-xl font-bold">Book</h1>
        <div role="tablist" aria-label="Book" class="ml-auto flex w-44">
          {(['players', 'plays'] as const).map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`book-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="book-panel"
              class={`${segment(tab === t)} ${i === 0 ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'}`}
              onClick={() => setTab(t)}
            >
              {t === 'players' ? 'Players' : 'Plays'}
            </button>
          ))}
        </div>
      </header>

      <div id="book-panel" role="tabpanel" aria-labelledby={`book-tab-${tab}`} class="flex min-h-0 flex-1 flex-col">
        {tab === 'players' ? (
          <>
            <div role="group" aria-label="Team" class="flex shrink-0 gap-0 border-b border-slate-700 px-3 py-2">
              {order.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={side === s}
                  class={`${segment(side === s)} min-w-0 truncate ${i === 0 ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'}`}
                  onClick={() => setSide(s)}
                >
                  {toggleText(game, s)}
                </button>
              ))}
            </div>
            <PlayersGrid game={game} side={side} tone={side === order[0] ? 'light' : 'dark'} />
          </>
        ) : (
          <Log
            store={store}
            showToast={false}
            headerExtra={(p) => (p < game.currentPeriod || game.endedAt ? <StatusChip store={store} period={p} /> : null)}
          />
        )}
      </div>

      {toast && (
        <FeedbackLine line={feedbackLine(null, null, toast)} class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-600" onUndo={undo} onRedo={redo} />
      )}
    </div>
  );
}

// Home rows light and Away rows dark, as on Live (D2). State colors per README § Colors, at the
// shades TeamHalf uses on each tone: bars at 3:1 or better, text at 4.5:1 or better.
const TONE = {
  light: {
    area: 'bg-slate-200 text-slate-900',
    head: 'bg-slate-300 text-slate-700',
    row: 'bg-white',
    foot: 'bg-slate-100',
    line: 'border-slate-300',
    name: 'text-slate-600',
    faint: 'text-slate-400',
    future: 'bg-slate-100',
    dot: 'bg-slate-700',
    bar: { ok: 'border-l-slate-400', warn: 'border-l-amber-600', out: 'border-l-red-600' },
    text: { ok: '', warn: 'text-amber-800', out: 'font-bold text-red-600' },
  },
  dark: {
    area: 'bg-slate-900 text-white',
    head: 'bg-slate-950 text-slate-300',
    row: 'bg-slate-800',
    foot: 'bg-slate-900',
    line: 'border-slate-700',
    name: 'text-slate-300',
    faint: 'text-slate-500',
    future: 'bg-slate-900',
    dot: 'bg-slate-300',
    bar: { ok: 'border-l-slate-500', warn: 'border-l-amber-400', out: 'border-l-red-500' },
    text: { ok: '', warn: 'text-amber-300', out: 'font-bold text-red-400' },
  },
} as const;

const PLAYER_COL = 78;
const TOTAL_COL = 56;
/** Up to OT2 (six periods) the quarter columns share the width; past it each keeps this and the grid scrolls (D3). */
const MIN_PERIOD_COL = 44;
const FIT_PERIODS = 6;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const cellName = (period: number, points: number, fouls: number) =>
  `${periodLabel(period)}: ${plural(points, 'point')}, ${plural(fouls, 'foul')}`;

function PlayersGrid({ game, side, tone }: { game: Game; side: Side; tone: 'light' | 'dark' }) {
  const grid = statsGrid(game, side);
  const t = TONE[tone];
  const minWidth = grid.periods.length > FIT_PERIODS ? PLAYER_COL + TOTAL_COL + MIN_PERIOD_COL * grid.periods.length : undefined;
  const future = (p: number) => !cellTappable(game, p);
  const faintDot = <span class={`text-xl font-bold ${t.faint}`} aria-hidden="true">·</span>;
  const td = `border-b ${t.line} text-center align-middle`;
  const sticky = `sticky left-0 z-[1] border-b ${t.line}`;

  return (
    <div data-testid="stats-grid" class={`min-h-0 flex-1 overflow-auto pb-20 ${t.area}`}>
      <table class="w-full table-fixed border-collapse tabular-nums" style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
        <colgroup>
          <col style={{ width: `${PLAYER_COL}px` }} />
          {grid.periods.map((p) => <col key={p} />)}
          <col style={{ width: `${TOTAL_COL}px` }} />
        </colgroup>
        <thead class={`sticky top-0 z-[2] ${t.head}`}>
          <tr class="h-8 text-sm font-semibold">
            <th scope="col" class={`sticky left-0 z-[1] px-2 text-left ${t.head}`}>Player</th>
            {grid.periods.map((p) => <th key={p} scope="col" class={future(p) ? t.faint : ''}>{periodLabel(p)}</th>)}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <PlayerRow key={r.key} r={r} periods={grid.periods} future={future} t={t} td={td} sticky={sticky} faintDot={faintDot} />
          ))}
        </tbody>
        <tfoot class={t.foot}>
          <tr aria-label="Team" class="h-12">
            <th scope="row" class={`${sticky} ${t.foot} px-2 text-left font-bold`}>Team</th>
            {grid.periods.map((p, i) => (
              <td key={p} class={td} aria-label={cellName(p, grid.team.points[i], grid.team.fouls[i])}>
                {future(p) ? faintDot : (
                  <div class="leading-tight">
                    <div class="text-lg font-bold">{grid.team.points[i]}</div>
                    <div class={`text-xs ${t.name}`}>F {grid.team.fouls[i]}</div>
                  </div>
                )}
              </td>
            ))}
            <td class={td} aria-label={`Total: ${plural(grid.team.total, 'point')}, ${plural(grid.team.totalFouls, 'foul')}`}>
              <div class="leading-tight">
                <div class="text-lg font-bold">{grid.team.total}</div>
                <div class={`text-xs ${t.name}`}>F {grid.team.totalFouls}</div>
              </div>
            </td>
          </tr>
          <tr aria-label="Score" class="h-12">
            <th scope="row" class={`${sticky} ${t.foot} px-2 text-left font-bold`}>Score</th>
            {grid.periods.map((p, i) => (
              <td key={p} class={`${td} text-sm font-semibold`} aria-label={`${periodLabel(p)}: Home ${grid.score.home[i]}, Away ${grid.score.away[i]}`}>
                {future(p) ? faintDot : `${grid.score.home[i]}–${grid.score.away[i]}`}
              </td>
            ))}
            <td class={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PlayerRow({ r, periods, future, t, td, sticky, faintDot }: {
  r: StatsRow;
  periods: number[];
  future: (p: number) => boolean;
  t: (typeof TONE)[keyof typeof TONE];
  td: string;
  sticky: string;
  faintDot: preact.JSX.Element;
}) {
  const label = r.player ? `#${r.player.number}${r.player.name ? ` ${r.player.name}` : ''}` : 'No number';
  const total = totalText(r);
  return (
    <tr aria-label={label} class={`h-12 ${t.row}`}>
      <th scope="row" class={`${sticky} ${t.row} border-l-[3px] px-2 text-left font-normal ${t.bar[r.foulState]}`}>
        {r.player ? (
          <div class="leading-tight">
            <div class="font-bold">#{r.player.number}</div>
            <div class={`truncate text-xs ${t.name}`}>{r.player.name}</div>
          </div>
        ) : (
          <div class="text-sm font-bold leading-tight">No number</div>
        )}
      </th>
      {r.cells.map((c, i) => (
        <QuarterCell key={periods[i]} c={c} period={periods[i]} future={future(periods[i])} t={t} td={td} faintDot={faintDot} />
      ))}
      <td class={td} aria-label={`Total: ${plural(r.points, 'point')}, ${total.fouls === 'OUT' ? 'out' : plural(r.fouls, 'foul')}${total.tech ? `, ${plural(r.techs, 'tech')}` : ''}`}>
        <div class="leading-tight">
          <div class="text-lg font-bold">{total.points}</div>
          <div class="text-xs">
            <span class={t.text[r.foulState]}>{total.fouls}</span>
            {total.tech && <span class={`ml-1 ${t.name}`}>{total.tech}</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}

/** D6: the quarter's points, large, over one dot per foul; a faint `·` with nothing. Task 4 hangs the cell sheet on `data-tappable`. */
function QuarterCell({ c, period, future, t, td, faintDot }: {
  c: StatsCell;
  period: number;
  future: boolean;
  t: (typeof TONE)[keyof typeof TONE];
  td: string;
  faintDot: preact.JSX.Element;
}) {
  return (
    <td
      class={`${td} ${future ? t.future : ''}`}
      data-tappable={String(!future)}
      aria-label={c.empty ? `${periodLabel(period)}: no plays` : cellName(period, c.points, c.fouls)}
    >
      {c.empty ? faintDot : (
        <div class="flex flex-col items-center leading-none">
          <span class="text-xl font-bold">{c.points}</span>
          {/* The dot line is always there, so every cell's number sits at one height. */}
          <span class="mt-1 flex min-h-1.5 flex-wrap justify-center gap-0.5" aria-hidden="true">
            {Array.from({ length: c.fouls }, (_, i) => <span key={i} data-testid="foul-dot" class={`h-1.5 w-1.5 rounded-full ${t.dot}`} />)}
          </span>
        </div>
      )}
    </td>
  );
}
