import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { deleteEvent, editEvent, insertEventBefore, moveFrom } from '../core/events';
import { periodLabel } from '../core/periods';
import type { EventType, GameEvent, Player, TimeoutKind } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { playButtonText, timeoutKindText, type PlayType } from './live-logic';
import {
  compatibleTypes, draftOf, editLabel, editPatch, eventLabel, eventRowText, groupByPeriod,
  insertLabel, isPlayType, moveFromCount, moveFromLabel, moveFromTargets, timeoutKindsFor,
  type EditDraft,
} from './log-logic';
import type { GameStore } from './store';

const TOAST_MS = 4000;
const btn = 'min-h-12 rounded-xl bg-slate-600 px-3 text-lg font-bold active:bg-slate-500';
const on = 'bg-white text-slate-900';
const action = 'min-h-12 w-full rounded-xl bg-slate-600 px-4 text-left text-lg font-semibold active:bg-slate-500';

type Step = 'actions' | 'edit' | 'moveFrom' | 'insertPlayer' | 'insertPlay';

interface Props {
  store: GameStore;
  /** Show one period only (Reconcile uses this). */
  period?: number;
  onClose?: () => void;
  /** Slot in each period header, e.g. status chips. */
  headerExtra?: (period: number) => ComponentChildren;
  /** Draw the toast bar; an embedding view that draws its own passes false. */
  showToast?: boolean;
}

export function Log({ store, period, onClose, headerExtra, showToast = true }: Props) {
  const { game, toast, clearToast, update, undo, setView } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('actions');
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [insertPlayer, setInsertPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!game) return null;
  const selected = game.events.find((e) => e.id === selectedId) ?? null;
  const groups = groupByPeriod(game, period);
  const close = onClose ?? (() => setView('live'));

  const open = (e: GameEvent) => {
    setSelectedId(e.id);
    setStep('actions');
    setDraft(null);
    setInsertPlayer(null);
  };
  const done = () => setSelectedId(null);

  const doDelete = (e: GameEvent) => {
    update((g, now) => deleteEvent(g, e.id, now), `Deleted ${eventLabel(game, e)}`);
    done();
  };
  const doEdit = (e: GameEvent, d: EditDraft) => {
    const patch = editPatch(e, d);
    if (Object.keys(patch).length > 0) update((g, now) => editEvent(g, e.id, patch, now), editLabel(game, e, patch));
    done();
  };
  const doMoveFrom = (e: GameEvent, to: number) => {
    const n = moveFromCount(game, e.id);
    update((g, now) => moveFrom(g, e.id, to, now), moveFromLabel(n, to));
    done();
  };
  const doInsert = (e: GameEvent, p: Player, type: PlayType) => {
    update((g, now) => insertEventBefore(g, e.id, { type, playerId: p.id }, now), insertLabel(type, p.number, e.period));
    done();
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={close}>
          Back
        </button>
        <h1 class="text-xl font-bold">Log{period !== undefined && ` · ${periodLabel(period)}`}</h1>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto pb-20">
        {groups.length === 0 && <p class="p-4 text-slate-300">No plays yet.</p>}
        {groups.map((grp) => (
          <section key={grp.period} aria-label={periodLabel(grp.period)}>
            <div class="flex min-h-11 items-center justify-between gap-2 bg-slate-800 px-3 py-1">
              <h2 class="text-lg font-bold">{periodLabel(grp.period)}</h2>
              {headerExtra?.(grp.period)}
            </div>
            <ul>
              {grp.events.map((e) => (
                <li key={e.id} class="border-b border-slate-800">
                  <button
                    type="button"
                    class="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left active:bg-slate-800"
                    onClick={() => open(e)}
                  >
                    <span class="min-w-0 truncate">{eventRowText(game, e)}</span>
                    {e.editedAt && (
                      <span class="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-amber-300">edited</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showToast && toast && (
        <div class="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-slate-600 bg-slate-700 px-3 py-1" role="status">
          <span class="truncate font-semibold">{toast.text}</span>
          {toast.canUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      )}

      {selected && step === 'actions' && (
        <Sheet title={eventRowText(game, selected)} onClose={done}>
          <div class="flex flex-col gap-2">
            <button type="button" class={action} onClick={() => { setDraft(draftOf(selected)); setStep('edit'); }}>Edit</button>
            <button type="button" class={action} onClick={() => doDelete(selected)}>Delete</button>
            <button type="button" class={action} onClick={() => setStep('insertPlayer')}>Insert before</button>
            {moveFromTargets(game, selected).length > 0 && (
              <button type="button" class={action} onClick={() => setStep('moveFrom')}>Move this and everything after to…</button>
            )}
          </div>
        </Sheet>
      )}
      {selected && step === 'edit' && draft && (
        <EditSheet
          game={game}
          event={selected}
          draft={draft}
          setDraft={setDraft}
          onSave={() => doEdit(selected, draft)}
          onClose={done}
        />
      )}
      {selected && step === 'moveFrom' && (
        <Sheet title={`Move ${moveFromCount(game, selected.id)} plays to`} onClose={done}>
          <div class="grid grid-cols-2 gap-2">
            {moveFromTargets(game, selected).map((p) => (
              <button key={p} type="button" class={btn} onClick={() => doMoveFrom(selected, p)}>
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {selected && step === 'insertPlayer' && (
        <Sheet title={`Insert before, in ${periodLabel(selected.period)}`} onClose={done}>
          <div class="grid max-h-[60dvh] grid-cols-2 gap-2 overflow-y-auto">
            {game.roster.map((p) => (
              <PlayerButton key={p.id} p={p} onClick={() => { setInsertPlayer(p); setStep('insertPlay'); }} />
            ))}
          </div>
        </Sheet>
      )}
      {selected && step === 'insertPlay' && insertPlayer && (
        <EventSheet
          player={insertPlayer}
          toast={null}
          onPlay={(t) => doInsert(selected, insertPlayer, t)}
          onUndo={undo}
          onClose={done}
        />
      )}
    </div>
  );
}

function PlayerButton({ p, onClick, selected }: { p: Player; onClick: () => void; selected?: boolean }) {
  return (
    <button type="button" class={`${btn} min-w-0 truncate text-left ${selected ? on : ''}`} onClick={onClick}>
      #{p.number} {p.name}
    </button>
  );
}

function EditSheet({ game, event, draft, setDraft, onSave, onClose }: {
  game: NonNullable<GameStore['game']>;
  event: GameEvent;
  draft: EditDraft;
  setDraft: (d: EditDraft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const types = compatibleTypes(event);
  const kinds = timeoutKindsFor(event);
  const periods = Array.from({ length: game.currentPeriod }, (_, i) => i + 1);
  const typeText = (t: EventType) => (t === 'BENCH_TECH' ? 'Bench T' : t === 'TIMEOUT' ? 'Timeout' : t === 'OPP_PTS' ? 'Opp' : playButtonText(t as PlayType));
  return (
    <Sheet title="Edit" onClose={onClose}>
      <div class="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        {types.length > 1 && (
          <div class="grid grid-cols-3 gap-2" role="group" aria-label="Play">
            {types.map((t) => (
              <button key={t} type="button" class={`${btn} ${draft.type === t ? on : ''}`} onClick={() => setDraft({ ...draft, type: t })}>
                {typeText(t)}
              </button>
            ))}
          </div>
        )}
        {kinds.length > 0 && (
          <div class="grid grid-cols-3 gap-2" role="group" aria-label="Timeout kind">
            {kinds.map((k: TimeoutKind) => (
              <button key={k} type="button" class={`${btn} ${draft.timeoutKind === k ? on : ''}`} onClick={() => setDraft({ ...draft, timeoutKind: k })}>
                {timeoutKindText(k)}
              </button>
            ))}
          </div>
        )}
        {event.type === 'OPP_PTS' && (
          <div class="grid grid-cols-3 gap-2" role="group" aria-label="Opponent points">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" class={`${btn} ${draft.oppPoints === n ? on : ''}`} onClick={() => setDraft({ ...draft, oppPoints: n })}>
                +{n}
              </button>
            ))}
          </div>
        )}
        {isPlayType(event.type) && (
          <div class="grid grid-cols-2 gap-2" role="group" aria-label="Player">
            {game.roster.map((p) => (
              <PlayerButton key={p.id} p={p} selected={draft.playerId === p.id} onClick={() => setDraft({ ...draft, playerId: p.id })} />
            ))}
          </div>
        )}
        {periods.length > 1 && (
          <div class="grid grid-cols-4 gap-2" role="group" aria-label="Period">
            {periods.map((p) => (
              <button key={p} type="button" class={`${btn} ${draft.period === p ? on : ''}`} onClick={() => setDraft({ ...draft, period: p })}>
                {periodLabel(p)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" class="min-h-12 rounded-lg border border-slate-400 px-5 font-semibold" onClick={onClose}>Cancel</button>
        <button type="button" class="min-h-12 rounded-lg bg-white px-6 font-semibold text-slate-900" onClick={onSave}>Save</button>
      </div>
    </Sheet>
  );
}
