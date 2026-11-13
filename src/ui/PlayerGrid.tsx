import type { PlayerLine } from '../core/derive';
import type { Player } from '../core/types';
import { countText } from './live-logic';

interface Props {
  roster: Player[];
  lines: PlayerLine[];
  onPick: (p: Player) => void;
  onBench: () => void;
  benchTechs: number;
}

// An out player's card is grayed (still red-bordered) so a tap on it reads as a mistake before it is one.
const border = { ok: 'border-slate-600', warn: 'border-amber-400', out: 'border-red-500 opacity-50' } as const;

export function PlayerGrid({ roster, lines, onPick, onBench, benchTechs }: Props) {
  return (
    <div class="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-4">
      {roster.map((p, i) => {
        const line = lines[i];
        const state = line?.foulState ?? 'ok';
        const fouls = line?.fouls ?? 0;
        const points = line?.points ?? 0;
        return (
          <button
            key={p.id}
            type="button"
            class={`relative min-h-[76px] rounded-xl border-2 bg-slate-800 p-2 text-left active:bg-slate-700 ${border[state]}`}
            onClick={() => onPick(p)}
            aria-label={`#${p.number} ${p.name}, ${countText(points, 'point', 'points')}, ${countText(fouls, 'foul', 'fouls')}${state === 'out' ? ', out' : ''}`}
          >
            <div class="flex items-baseline justify-between">
              <span class="text-3xl font-bold leading-none">{p.number}</span>
              <span class="text-lg font-semibold tabular-nums">
                {points} <span class="text-sm font-normal text-slate-300">pts</span>
              </span>
            </div>
            <div class="mt-1 truncate text-sm text-slate-300">{p.name || ' '}</div>
            <div class="mt-1 flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  class={`h-2.5 w-2.5 rounded-full ${n < fouls ? (state === 'out' ? 'bg-red-500' : 'bg-amber-400') : 'border border-slate-500'}`}
                />
              ))}
              {state === 'out' && <span class="ml-1 text-xs font-bold text-red-400">OUT</span>}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        class={`flex min-h-[76px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-slate-900 p-2 text-xl font-bold active:bg-slate-700 ${benchTechs > 0 ? 'border-amber-400' : 'border-slate-500'}`}
        aria-label={benchTechs > 0 ? `Bench, ${countText(benchTechs, 'tech', 'techs')}` : 'Bench'}
        onClick={onBench}
      >
        Bench
        {benchTechs > 0 && (
          <span class="text-sm font-semibold text-amber-300" data-testid="bench-techs">
            {countText(benchTechs, 'tech', 'techs')}
          </span>
        )}
      </button>
    </div>
  );
}
