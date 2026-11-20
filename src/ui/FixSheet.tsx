import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { deleteEvent, homeSide, rosterOf, sideOf } from '../core/events';
import { periodLabel } from '../core/periods';
import type { EventType, GameEvent, Player, Side, TimeoutKind } from '../core/types';
import { Sheet } from './EventSheet';
import { BENCH_TECH_TEXT, NO_NUMBER, playButtonText, timeoutKindText, type PlayType } from './live-logic';
import {
  alsoMoveText, canSave, compatibleTypes, draftOf, editSave, editTitle, eventLabel, followersCount,
  isPlayType, timeoutKindsFor, type EditDraft,
} from './log-logic';
import type { GameStore } from './store';

const btn = 'min-h-12 rounded-xl bg-slate-600 px-3 text-lg font-bold active:bg-slate-500';
const on = 'bg-white text-slate-900';

/**
 * The fix sheet for one play: change its play, team, player or quarter (and "also move" the plays
 * after it), Save, or Delete. Opened from the Plays list and, from 0.11, from a Book cell. Save
 * and Delete each count toward the usage record (`edits`, `deletes`); either closes the sheet.
 * Key it by the event id so a new play starts from a fresh draft.
 */
export function FixSheet({ store, event, onClose }: { store: GameStore; event: GameEvent; onClose: () => void }) {
  const { game, update } = store;
  const [draft, setDraft] = useState<EditDraft>(() => draftOf(event));
  const [alsoMove, setAlsoMove] = useState(false);
  if (!game) return null;

  const doDelete = () => {
    update((g, now) => deleteEvent(g, event.id, now), `Deleted ${eventLabel(game, event)}`);
    store.bump('deletes');
    onClose();
  };
  const doSave = () => {
    const save = editSave(game, event, draft, alsoMove);
    if (save) {
      update(save.apply, save.label);
      store.bump('edits');
    }
    onClose();
  };

  return (
    <EditSheet
      game={game}
      event={event}
      draft={draft}
      setDraft={setDraft}
      alsoMove={alsoMove}
      setAlsoMove={setAlsoMove}
      onSave={doSave}
      onDelete={doDelete}
      onClose={onClose}
    />
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
  // Switching team drops the old team's player; going back to the play's own team restores it.
  const draftSide: Side = draft.side === 'them' ? 'them' : 'us';
  const pickTeam = (side: Side) => {
    if (side === draftSide) return;
    const own = side === sideOf(event);
    setDraft({
      ...draft,
      side: side === 'them' ? 'them' : undefined,
      playerId: own ? event.playerId : undefined,
      unpicked: isPlayType(event.type) && !own,
    });
  };
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
        {event.type !== 'OPP_PTS' && (
          <Group label="Team" cols="grid-cols-2">
            {(['Home', 'Away'] as const).map((tag) => {
              const side: Side = (tag === 'Home') === (homeSide(game) === 'us') ? 'us' : 'them';
              return (
                <button key={tag} type="button" class={`${btn} ${draftSide === side ? on : ''}`} onClick={() => pickTeam(side)}>
                  {tag}
                </button>
              );
            })}
          </Group>
        )}
        {isPlayType(event.type) && (
          <Group label="Player" cols="grid-cols-2">
            {rosterOf(game, draftSide).map((p) => (
              <PlayerButton key={p.id} p={p} selected={draft.playerId === p.id} onClick={() => setDraft({ ...draft, playerId: p.id, unpicked: false })} />
            ))}
            <button
              type="button"
              class={`${btn} ${draft.playerId === undefined && !draft.unpicked ? on : ''}`}
              onClick={() => setDraft({ ...draft, playerId: undefined, unpicked: false })}
            >
              {NO_NUMBER}
            </button>
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
            class="h-6 w-6 shrink-0 accent-sky-400"
            checked={alsoMove}
            onChange={(e) => setAlsoMove(e.currentTarget.checked)}
          />
          {alsoMoveText(followers, event.period)}
        </label>
      )}
      <div class="mt-3 flex gap-2">
        <button type="button" class="min-h-12 rounded-lg border border-red-400 px-4 font-semibold text-red-300" onClick={onDelete}>Delete</button>
        <button type="button" class="ml-auto min-h-12 rounded-lg border border-slate-400 px-5 font-semibold" onClick={onClose}>Cancel</button>
        <button type="button" class="min-h-12 rounded-lg bg-white px-6 font-semibold text-slate-900 disabled:opacity-40" disabled={!canSave(draft)} onClick={onSave}>Save</button>
      </div>
    </Sheet>
  );
}
