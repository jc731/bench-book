import { useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { rosterOf, sideName } from '../core/events';
import { lineup } from '../core/lineup';
import type { Game, Player, Side } from '../core/types';
import { Sheet } from './EventSheet';
import { outReason } from './live-logic';
import { SUB_TITLE, closesNow, netSub, openSub, pickText, toggleFloor, type SubStart } from './sub-logic';

interface Props {
  game: Game;
  side: Side;
  /** The player a play sheet's sub row already moved, or null from the team's Sub button. */
  start: SubStart;
  /** The net change, once: called when the sheet completes (Done, or the floor reaching five). */
  onRecord: (ins: string[], outs: string[]) => void;
  /** Cancel or the backdrop: nothing is recorded. */
  onClose: () => void;
}

/**
 * One team's sub sheet (design 2026-11-17, decision 9), titled for its mode. Every row is a toggle,
 * pressed when that player is on the floor; rows never move while the sheet is open, so a second tap
 * undoes a first.
 */
export function SubSheet({ game, side, start, onRecord, onClose }: Props) {
  // Fixed at opening: the floor and the mode are what the sheet was opened on.
  const [opened] = useState(() => {
    const l = lineup(game, side);
    return { l, ...openSub(l, start) };
  });
  const { l, mode } = opened;
  const [floor, setFloor] = useState<string[]>(opened.floor);

  const roster = rosterOf(game, side);
  const team = side === 'us' ? derive(game).us : derive(game).opp;
  const reasonOf = (id: string) => outReason(team.players.find((p) => p.playerId === id));
  const justIn = start?.in ?? l.justIn;
  const byId = new Map(roster.map((p) => [p.id, p]));
  const players = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is Player => !!p);

  const finish = (next: string[]) => {
    const { ins, outs } = netSub(l.floor, next);
    onRecord(ins, outs);
  };
  const tap = (id: string) => {
    const next = toggleFloor(floor, id, l.outIds);
    setFloor(next);
    if (closesNow(mode, next)) finish(next);
  };

  const row = (p: Player) => {
    const on = floor.includes(p.id);
    const reason = reasonOf(p.id);
    const tags = reason
      ? [reason]
      : mode === 'out'
        ? [...(p.id === justIn ? ['just in'] : []), ...(p.id === l.suggestion ? ['likely'] : [])]
        : [];
    const label = `${`#${p.number} ${p.name}`.trim()}${tags.map((t) => `, ${t}`).join('')}`;
    return (
      <button
        key={p.id}
        type="button"
        aria-pressed={on}
        aria-label={label}
        disabled={reason !== null && !on}
        class={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-left font-semibold ${
          on ? 'border-slate-300 bg-slate-600 active:bg-slate-500' : 'border-slate-600 bg-transparent active:bg-slate-700'
        } ${reason ? 'opacity-40' : ''}`}
        onClick={() => tap(p.id)}
      >
        <span class="truncate">
          <span class="text-xl font-bold">#{p.number}</span> <span class="text-sm text-slate-300">{p.name}</span>
        </span>
        <span class="flex shrink-0 gap-1">
          {tags.map((t) => (
            <span key={t} class="rounded border border-slate-400 px-1.5 text-xs font-semibold text-slate-300">{t}</span>
          ))}
        </span>
      </button>
    );
  };

  const list = (ids: string[]) => <div class="flex flex-col gap-1.5">{players(ids).map(row)}</div>;
  const atOpen = opened.floor;
  const benchAtOpen = roster.map((p) => p.id).filter((id) => !atOpen.includes(id));
  const count = floor.length;
  const pick = pickText(mode, count);

  return (
    <Sheet title={SUB_TITLE[mode]} onClose={onClose}>
      <p class="-mt-1 mb-2 text-sm text-slate-300">
        {sideName(game, side)}
        {pick && (
          <>
            {' · '}
            <span class="font-semibold text-white" data-testid="sub-pick" aria-live="polite">{pick}</span>
          </>
        )}
      </p>
      {/* The list scrolls inside the sheet with a long roster; the buttons below stay put. */}
      <div class="max-h-[55vh] overflow-y-auto">
        {mode === 'out' && list(atOpen)}
        {mode === 'in' && list(benchAtOpen)}
        {mode === 'set' && (
          <div class="flex flex-col gap-3">
            <div role="group" aria-label="On the floor">
              <h3 class="mb-1 text-sm font-semibold text-slate-300">On the floor</h3>
              {list(atOpen)}
            </div>
            <div role="group" aria-label="On the bench">
              <h3 class="mb-1 text-sm font-semibold text-slate-300">On the bench</h3>
              {list(benchAtOpen)}
            </div>
          </div>
        )}
      </div>
      <div class="mt-3 flex min-h-11 items-center justify-between gap-2">
        {mode === 'set' ? (
          <span class={`text-sm font-semibold ${count === 5 ? 'text-green-400' : 'text-slate-300'}`} data-testid="sub-count" aria-live="polite">
            {count} on the floor
          </span>
        ) : (
          <span />
        )}
        <div class="flex gap-2">
          <button type="button" class="min-h-11 rounded-lg border border-slate-400 px-4 font-semibold" onClick={onClose}>
            Cancel
          </button>
          {mode === 'set' && (
            <button type="button" class="min-h-11 rounded-lg bg-white px-5 font-semibold text-slate-900" onClick={() => finish(floor)}>
              Done
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
