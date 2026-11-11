import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { deleteEvent } from '../core/events';
import { periodLabel } from '../core/periods';
import type { EventType, GameEvent, Player, TimeoutKind } from '../core/types';
import { Sheet } from './EventSheet';
import { FeedbackLine } from './FeedbackLine';
import { BENCH_TECH_TEXT, feedbackLine, playButtonText, timeoutKindText, type PlayType } from './live-logic';
import {
  alsoMoveText, compatibleTypes, draftOf, editSave, editTitle, eventLabel, eventRowText, followersCount, groupByPeriod,
  isPlayType, timeoutKindsFor, type EditDraft,
} from './log-logic';
import type { GameStore } from './store';

const btn = 'min-h-12 rounded-xl bg-slate-600 px-3 text-lg font-bold active:bg-slate-500';
const on = 'bg-white text-slate-900';

interface Props {
  store: GameStore;
  /** Show one period only (Reconcile uses this). */
  period?: number;
  /** `newest` (the Log) or `oldest` (the quarter check, walked beside the book). */
  order?: 'newest' | 'oldest';
  onClose?: () => void;
  /** Slot in each period header, e.g. status chips. */
  headerExtra?: (period: number) => ComponentChildren;
  /** Draw the feedback line; an embedding view that draws its own passes false. */
  showToast?: boolean;
  /** Inside another screen (the quarter check): no header and no Back of its own. */
  embedded?: boolean;
}

export function Log({ store, period, order = 'newest', onClose, headerExtra, showToast = true, embedded = false }: Props) {
  const { game, toast, update, undo, setView } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [alsoMove, setAlsoMove] = useState(false);

  if (!game) return null;
  const selected = game.events.find((e) => e.id === selectedId) ?? null;
  const groups = groupByPeriod(game, period, order);
  const close = onClose ?? (() => setView('live'));

  const open = (e: GameEvent) => {
    setSelectedId(e.id);
    setDraft(draftOf(e));
    setAlsoMove(false);
  };
  const done = () => setSelectedId(null);

  const doDelete = (e: GameEvent) => {
    update((g, now) => deleteEvent(g, e.id, now), `Deleted ${eventLabel(game, e)}`);
    done();
  };
  const doSave = (e: GameEvent, d: EditDraft) => {
    const save = editSave(game, e, d, alsoMove);
    if (save) update(save.apply, save.label);
    done();
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      {!embedded && (
        <header class="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
          <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={close}>
            Back
          </button>
          <h1 class="text-xl font-bold">Log{period !== undefined && ` · ${periodLabel(period)}`}</h1>
        </header>
      )}
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
                      <span class="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-amber-300">edited</span>
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
        <FeedbackLine line={feedbackLine(null, null, toast)} class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-600" onUndo={undo} />
      )}

      {selected && draft && (
        <EditSheet
          game={game}
          event={selected}
          draft={draft}
          setDraft={setDraft}
          alsoMove={alsoMove}
          setAlsoMove={setAlsoMove}
          onSave={() => doSave(selected, draft)}
          onDelete={() => doDelete(selected)}
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

/** One labeled group of the fix sheet, with a visible heading. */
function Group({ label, cols, children }: { label: string; cols: string; children: ComponentChildren }) {
  return (
    <div role="group" aria-label={label}>
      <h3 class="mb-1 text-sm font-semibold text-slate-300">{label}</h3>
      <div class={`grid ${cols} gap-2`}>{children}</div>
    </div>
  );
}

function EditSheet({ game, event, draft, setDraft, alsoMove, setAlsoMove, onSave, onDelete, onClose }: {
  game: NonNullable<GameStore['game']>;
  event: GameEvent;
  draft: EditDraft;
  setDraft: (d: EditDraft) => void;
  alsoMove: boolean;
  setAlsoMove: (on: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const types = compatibleTypes(event);
  const kinds = timeoutKindsFor(event);
  const periods = Array.from({ length: game.currentPeriod }, (_, i) => i + 1);
  const followers = followersCount(game, event.id);
  const typeText = (t: EventType) => (t === 'BENCH_TECH' ? BENCH_TECH_TEXT : t === 'TIMEOUT' ? 'Timeout' : t === 'OPP_PTS' ? 'Opp' : playButtonText(t as PlayType));
  return (
    <Sheet title={editTitle(game, event)} onClose={onClose}>
      <div class="flex max-h-[65dvh] flex-col gap-3 overflow-y-auto">
        {types.length > 1 && (
          <Group label="Play" cols="grid-cols-3">
            {types.map((t) => (
              <button key={t} type="button" class={`${btn} ${draft.type === t ? on : ''}`} onClick={() => setDraft({ ...draft, type: t })}>
                {typeText(t)}
              </button>
            ))}
          </Group>
        )}
        {kinds.length > 0 && (
          <Group label="Play" cols="grid-cols-3">
            {kinds.map((k: TimeoutKind) => (
              <button key={k} type="button" class={`${btn} ${draft.timeoutKind === k ? on : ''}`} onClick={() => setDraft({ ...draft, timeoutKind: k })}>
                {timeoutKindText(k)}
              </button>
            ))}
          </Group>
        )}
        {event.type === 'OPP_PTS' && (
          <Group label="Play" cols="grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" class={`${btn} ${draft.oppPoints === n ? on : ''}`} onClick={() => setDraft({ ...draft, oppPoints: n })}>
                +{n}
              </button>
            ))}
          </Group>
        )}
        {isPlayType(event.type) && (
          <Group label="Player" cols="grid-cols-2">
            {game.roster.map((p) => (
              <PlayerButton key={p.id} p={p} selected={draft.playerId === p.id} onClick={() => setDraft({ ...draft, playerId: p.id })} />
            ))}
          </Group>
        )}
        {periods.length > 1 && (
          <Group label="Quarter" cols="grid-cols-4">
            {periods.map((p) => (
              <button key={p} type="button" class={`${btn} ${draft.period === p ? on : ''}`} onClick={() => { setDraft({ ...draft, period: p }); if (p === event.period) setAlsoMove(false); }}>
                {periodLabel(p)}
              </button>
            ))}
          </Group>
        )}
      </div>
      {/* Outside the scroller, just above Save: picking a quarter must never hide it below the fold. */}
      {draft.period !== event.period && followers > 0 && (
        <label class="mt-3 flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            class="h-6 w-6 shrink-0 accent-amber-400"
            checked={alsoMove}
            onChange={(e) => setAlsoMove(e.currentTarget.checked)}
          />
          {alsoMoveText(followers, event.period)}
        </label>
      )}
      <div class="mt-3 flex gap-2">
        <button type="button" class="min-h-12 rounded-lg border border-red-400 px-4 font-semibold text-red-300" onClick={onDelete}>Delete</button>
        <button type="button" class="ml-auto min-h-12 rounded-lg border border-slate-400 px-5 font-semibold" onClick={onClose}>Cancel</button>
        <button type="button" class="min-h-12 rounded-lg bg-white px-6 font-semibold text-slate-900" onClick={onSave}>Save</button>
      </div>
    </Sheet>
  );
}
