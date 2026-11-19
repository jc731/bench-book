import type { Player } from '../core/types';
import { MAX_PLAYERS } from './roster';

const input =
  'min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-base text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none';
const secondary = 'min-h-11 rounded-lg px-4 font-semibold border border-slate-500 bg-slate-800 text-white';

export function blankPlayer(): Player {
  return { id: crypto.randomUUID(), number: '', name: '', pos: '' };
}

/**
 * Roster rows, "Add <prefix> player" and remove. Field labels are `${idPrefix} ${n} number` / `name`.
 * `locked` (Edit teams, D14): id → why the row can't be removed ("has plays" or "on the floor"); its
 * × is disabled and the row says the reason in gray.
 */
export function RosterEditor({
  label,
  players,
  onChange,
  idPrefix,
  locked,
}: {
  label: string;
  players: Player[];
  onChange: (p: Player[]) => void;
  idPrefix: string;
  locked?: Map<string, string>;
}) {
  const set = (id: string, k: keyof Player, v: string) =>
    onChange(players.map((p) => (p.id === id ? { ...p, [k]: v } : p)));
  const lower = idPrefix.toLowerCase();
  const addLabel = idPrefix === 'Player' ? 'Add player' : 'Add their player';
  return (
    <section class="mb-4">
      <h2 class="mb-2 text-lg font-semibold">
        {label} <span class="text-sm font-normal text-slate-300">({players.length}/{MAX_PLAYERS})</span>
      </h2>
      <div class="flex flex-col gap-2">
        {players.map((p, i) => {
          const reason = locked?.get(p.id);
          const isLocked = reason !== undefined;
          return (
            <div class="flex flex-col gap-1" key={p.id}>
              <div class="flex items-center gap-2">
                <input
                  class={`${input} w-[4.5rem]! min-w-0 shrink-0`}
                  aria-label={`${idPrefix} ${i + 1} number`}
                  placeholder="#"
                  inputMode="numeric"
                  value={p.number}
                  onInput={(e) => set(p.id, 'number', e.currentTarget.value)}
                />
                <input
                  class={`${input} min-w-0 flex-1`}
                  aria-label={`${idPrefix} ${i + 1} name`}
                  placeholder="Name"
                  value={p.name}
                  onInput={(e) => set(p.id, 'name', e.currentTarget.value)}
                />
                <button
                  type="button"
                  class="h-11 w-11 shrink-0 rounded-lg border border-slate-500 bg-slate-800 text-xl text-white disabled:opacity-40"
                  aria-label={`Remove ${lower} ${i + 1}`}
                  aria-describedby={isLocked ? `locked-${p.id}` : undefined}
                  disabled={isLocked}
                  onClick={() => onChange(players.filter((x) => x.id !== p.id))}
                >
                  ×
                </button>
              </div>
              {isLocked && (
                <span id={`locked-${p.id}`} class="pl-1 text-sm text-slate-400">
                  {reason}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div class="mt-3">
        <button
          type="button"
          class={secondary}
          disabled={players.length >= MAX_PLAYERS}
          onClick={() => onChange([...players, blankPlayer()])}
        >
          {addLabel}
        </button>
      </div>
    </section>
  );
}
