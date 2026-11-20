import { useRef, useState } from 'preact/hooks';
import { isLateAdd } from '../core/late';
import { periodLabel } from '../core/periods';
import { rosterOf } from '../core/events';
import type { GameEvent, Side } from '../core/types';
import { PlayButtons, Sheet } from './EventSheet';
import { FixSheet } from './FixSheet';
import { outReason, type PlayType, type Toast } from './live-logic';
import { eventRowText } from './log-logic';
import { addFeedback, addToCell, cellPlays, cellTitle, statsGrid } from './stats-logic';
import type { GameStore } from './store';

export interface CellRef {
  side: Side;
  /** null for the No number row. */
  playerId: string | null;
  period: number;
}

type Tone = 'plain' | 'amber' | 'red';

// README § Colors: red for out, amber for caution (a check that no longer matches), gray the rest.
const TONE_CLASS: Record<Tone, string> = { plain: 'text-slate-200', amber: 'text-amber-300', red: 'text-red-300' };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * A Book cell's sheet (D9): the quarter's and the game's points and fouls, the cell's plays (each
 * opens the Log's fix sheet), the six play buttons that add to this quarter (D10-D12), its own
 * feedback line with Undo, and Done. It stays open after an add, so the list gains the play.
 */
export function CellSheet({ store, cell, onClose }: { store: GameStore; cell: CellRef; onClose: () => void }) {
  const { game, toast, update, undo, redo, bump } = store;
  const { side, playerId, period } = cell;
  // Only feedback made while the sheet is open; the line behind it may hold something older.
  const openedWith = useRef<Toast | null>(toast);
  // The tone of the last add (D12). It belongs to that add's text only: an Undo or an edit reads plain.
  const [last, setLast] = useState<{ text: string; tone: Tone } | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  if (!game) return null;

  const player = playerId ? rosterOf(game, side).find((p) => p.id === playerId) ?? null : null;
  const grid = statsGrid(game, side);
  const col = grid.periods.indexOf(period);
  const r = grid.rows.find((x) => x.key === (playerId ?? 'none'));
  const q = r && col >= 0 ? r.cells[col] : { points: 0, fouls: 0 };
  const plays = cellPlays(game, side, playerId, period);
  // Review Focus 5: an out player's plays wait behind the same warning as on the live sheet.
  const out = player && r ? outReason({ fouls: r.fouls, techs: r.techs }) : null;

  const add = (type: PlayType) => {
    // D14: an add after its quarter is a late add, otherwise a play.
    bump(isLateAdd(game, period) ? 'lateAdds' : 'plays');
    let made: { text: string; tone: Tone } | null = null;
    // The label is worded from the game the add is applied to, not the one on screen (plan critique 4).
    update((g, now) => {
      const after = addToCell(g, side, playerId, type, period, now);
      made = addFeedback(g, after, side, player, type, period);
      return { game: after, label: made.text };
    }, '');
    setLast(made);
  };

  const fixEvent: GameEvent | undefined = fixing ? game.events.find((e) => e.id === fixing) : undefined;
  if (fixEvent) return <FixSheet key={fixEvent.id} store={store} event={fixEvent} onClose={() => setFixing(null)} />;

  const shown = toast && toast !== openedWith.current ? toast : null;
  const tone: Tone = shown && shown.canUndo && last && shown.text === last.text ? last.tone : 'plain';
  const label = periodLabel(period);

  return (
    <Sheet title={cellTitle(game, side, player, period)} onClose={onClose}>
      <p class="mb-2 text-sm text-slate-300" data-testid="cell-summary">
        {label}: {plural(q.points, 'point')}, {plural(q.fouls, 'foul')} · Game: {plural(r?.points ?? 0, 'point')}, {plural(r?.fouls ?? 0, 'foul')}
      </p>
      {plays.length > 0 && (
        <ul aria-label="Plays" class="mb-3 flex max-h-[24dvh] flex-col gap-1.5 overflow-y-auto">
          {plays.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                class="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 text-left active:bg-slate-700"
                onClick={() => setFixing(e.id)}
              >
                <span class="min-w-0 flex-1 truncate">{eventRowText(game, e)}</span>
                {e.editedAt && <span class="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-200">edited</span>}
                <span class="shrink-0 text-2xl leading-none text-slate-400" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 class="mb-1 text-sm font-semibold text-slate-300">Add to {label}</h3>
      <PlayButtons out={out} onPlay={add} />
      <div class="mt-3 flex min-h-11 items-center gap-2" role="status">
        {/* Wraps, never truncates: the out line must be read whole (plan critique 1, 6). */}
        <p class={`min-w-0 flex-1 break-words text-sm font-semibold leading-tight ${TONE_CLASS[tone]}`} data-testid="cell-feedback" data-tone={tone}>
          {shown ? shown.text : ''}
        </p>
        {shown?.canUndo && (
          <button type="button" class="min-h-11 shrink-0 rounded-lg border border-sky-300 px-4 font-semibold text-sky-300" onClick={undo}>
            Undo
          </button>
        )}
        {shown?.canRedo && (
          <button type="button" class="min-h-11 shrink-0 rounded-lg border border-sky-300 px-4 font-semibold text-sky-300" onClick={redo}>
            Redo
          </button>
        )}
      </div>
      <button type="button" class="mt-2 min-h-12 w-full rounded-lg bg-white font-semibold text-slate-900" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}
