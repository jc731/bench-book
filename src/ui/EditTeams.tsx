import { useState } from 'preact/hooks';
import { applyTeams, lockReasons, teamsDraftOf, type TeamsDraft } from '../core/edit-teams';
import type { Player } from '../core/types';
import { cleanOppRoster, defaultOpponent, setupRosterErrors } from './roster';
import { RosterEditor } from './RosterEditor';
import type { GameStore } from './store';

const input =
  'min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-base text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none';
const btn = 'min-h-11 rounded-lg px-4 font-semibold';
const secondary = `${btn} border border-slate-500 bg-slate-800 text-white`;

/**
 * Edit teams (design 2026-11-19, D10-D14): both names and both rosters mid-game, as one undoable save.
 * Its own view, not Setup, so the wake lock holds and Setup's discard prompt never shows. It never saves
 * the roster for the next game (a spec non-goal).
 */
export function EditTeams({ store }: { store: GameStore }) {
  const { game, update, bump, setView } = store;
  const [draft, setDraft] = useState<TeamsDraft | null>(() => (game ? teamsDraftOf(game) : null));
  const [tried, setTried] = useState(false);
  if (!game || !draft) return null;
  const locked = lockReasons(game);
  const set = (k: keyof TeamsDraft, v: string | Player[]) => setDraft({ ...draft, [k]: v });

  // D11: Setup's validation. A row blanked out entirely is dropped by the cleaning, so a locked player
  // (plays, a sub, or on the floor) emptied that way is caught here rather than thrown by applyTeams.
  const roster = cleanOppRoster(draft.roster);
  const oppRoster = cleanOppRoster(draft.oppRoster);
  const kept = new Set([...roster, ...oppRoster].map((p) => p.id));
  const lost = [...game.roster, ...game.oppRoster].filter((p) => locked.has(p.id) && !kept.has(p.id));
  const errors = [
    ...setupRosterErrors(draft.roster, draft.oppRoster),
    ...(lost.length ? [`A player with plays or on the floor needs a number: ${lost.map((p) => `#${p.number}`).join(', ')}.`] : []),
  ];

  const onSave = () => {
    setTried(true);
    if (errors.length) return;
    const clean: TeamsDraft = { ...draft, roster, oppRoster };
    // A Save that changes nothing records nothing: no undo step, no feedback, no count.
    if (applyTeams(game, clean, new Date()) !== game) {
      update((g, now) => applyTeams(g, clean, now), 'Edited teams');
      bump('teamEdits');
    }
    setView('live');
  };

  return (
    <main class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-xl p-4 pb-24">
        <h1 class="mb-4 text-2xl font-bold">Edit teams</h1>
        <div class="mb-6 flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-slate-300">Our team</span>
            <input class={input} value={draft.team} onInput={(e) => set('team', e.currentTarget.value)} />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-slate-300">Opponent</span>
            <input
              class={input}
              aria-describedby="edit-opponent-hint"
              value={draft.opponent}
              onInput={(e) => set('opponent', e.currentTarget.value)}
            />
            <span id="edit-opponent-hint" class="text-sm text-slate-400">
              Left blank, the game is named {defaultOpponent(game.info.date)}
            </span>
          </label>
        </div>

        <RosterEditor label="Our roster" players={draft.roster} onChange={(p) => set('roster', p)} idPrefix="Player" locked={locked} />
        <RosterEditor
          label="Their roster"
          players={draft.oppRoster}
          onChange={(p) => set('oppRoster', p)}
          idPrefix="Their player"
          locked={locked}
        />

        {tried && errors.length > 0 && (
          <ul class="mb-4 rounded-lg border border-red-400 bg-slate-800 p-3 text-red-300" role="alert">
            {errors.map((e) => (
              <li>{e}</li>
            ))}
          </ul>
        )}

        <div class="flex flex-col gap-3">
          <button type="button" class={`${btn} bg-white text-lg text-slate-900`} onClick={onSave}>
            Save
          </button>
          <button type="button" class={secondary} onClick={() => setView('live')}>
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}
