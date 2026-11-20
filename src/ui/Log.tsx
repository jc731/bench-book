import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { periodLabel } from '../core/periods';
import type { GameEvent } from '../core/types';
import { FeedbackLine } from './FeedbackLine';
import { FixSheet } from './FixSheet';
import { feedbackLine } from './live-logic';
import { eventRowText, groupByPeriod } from './log-logic';
import type { GameStore } from './store';

interface Props {
  store: GameStore;
  /** Show one period only (Reconcile uses this)... */
  period?: number;
  /** ...or, with this, every period from `fromPeriod` through `period` (a check that spans skipped quarters). */
  fromPeriod?: number;
  /** `newest` (the Log) or `oldest` (the quarter check, walked beside the book). */
  order?: 'newest' | 'oldest';
  /** Slot in each period header, e.g. status chips. */
  headerExtra?: (period: number) => ComponentChildren;
  /** Draw the feedback line; an embedding view that draws its own passes false. */
  showToast?: boolean;
}

/** The play list, always inside another screen (Book's Plays tab, the quarter check), which draws the header and Back. */
export function Log({ store, period, fromPeriod, order = 'newest', headerExtra, showToast = true }: Props) {
  const { game, toast, undo, redo } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!game) return null;
  const selected = game.events.find((e) => e.id === selectedId) ?? null;
  const groups = groupByPeriod(game, period, order, fromPeriod);

  const open = (e: GameEvent) => setSelectedId(e.id);
  const done = () => setSelectedId(null);

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="min-h-0 flex-1 overflow-y-auto pb-20">
        {groups.length === 0 && <p class="p-4 text-slate-300">No plays yet.</p>}
        {groups.map((grp) => (
          <section key={grp.period} aria-label={periodLabel(grp.period)}>
            <div class="flex min-h-11 items-center justify-between gap-2 bg-slate-800 px-3 py-1">
              <h2 class="text-lg font-bold">{periodLabel(grp.period)}</h2>
              {headerExtra?.(grp.period)}
            </div>
            <ul class="flex flex-col gap-1.5 p-2">
              {grp.events.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    class="flex min-h-12 w-full items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 text-left active:bg-slate-800"
                    onClick={() => open(e)}
                  >
                    <span class="min-w-0 flex-1 truncate">{eventRowText(game, e)}</span>
                    {e.editedAt && (
                      <span class="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-200">edited</span>
                    )}
                    <span class="shrink-0 text-2xl leading-none text-slate-400" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showToast && toast && (
        <FeedbackLine line={feedbackLine(null, null, toast)} class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-600" onUndo={undo} onRedo={redo} />
      )}

      {selected && <FixSheet key={selected.id} store={store} event={selected} onClose={done} />}
    </div>
  );
}
