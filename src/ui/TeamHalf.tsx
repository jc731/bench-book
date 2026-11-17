import type { TeamDerived } from '../core/derive';
import { isOvertime } from '../core/periods';
import type { Player, TimeoutKind } from '../core/types';
import { BENCH_CARD_TEXT, countText, teamFoulsWarn, timeoutButtonText, timeoutsLeft, type TeamTag } from './live-logic';

interface Props {
  side: TeamTag;
  /** Home is light (the home team traditionally wears white), Away dark. */
  tone: 'light' | 'dark';
  /** Our team's half carries the US tag. */
  isUs: boolean;
  roster: Player[];
  team: TeamDerived;
  period: number;
  onPick: (p: Player) => void;
  /** The dashed + Play card: a play for this team with no player picked. */
  onTeamPlay: () => void;
  onBench: () => void;
  onTimeout: (kind: TimeoutKind) => void;
}

// One job per color (README § Colors) on both tones. An element whose border shows a state (a card,
// Bench) gets exactly one border-color class: two on one element resolve by stylesheet order, not class order. Task 7 settles the light-card contrast; amber and
// red keep their dark-card shades here so the 4-foul and out states read the same on either half.
const TONE = {
  light: {
    half: 'bg-slate-200 text-slate-900',
    card: 'bg-white active:bg-slate-100',
    ok: 'border-slate-400',
    name: 'text-slate-600',
    dotEmpty: 'border border-slate-400',
    dotOk: 'bg-slate-700',
    outText: 'text-red-600',
    dashed: 'bg-slate-100 active:bg-slate-300',
    tag: 'border-slate-700 text-slate-700',
    foulsWarn: 'text-amber-700',
    timeout: 'border-slate-400 bg-white active:bg-slate-100',
  },
  dark: {
    half: 'bg-slate-900 text-white',
    card: 'bg-slate-800 active:bg-slate-700',
    ok: 'border-slate-600',
    name: 'text-slate-300',
    dotEmpty: 'border border-slate-500',
    dotOk: 'bg-slate-300',
    outText: 'text-red-400',
    dashed: 'bg-slate-900 active:bg-slate-700',
    tag: 'border-white text-white',
    foulsWarn: 'text-amber-300',
    timeout: 'border-slate-500 bg-slate-700 active:bg-slate-600',
  },
} as const;

/**
 * One team's half of the live screen: a header (team, US tag, team fouls), its player cards in two
 * columns, then a dashed + Play card, the half-height Bench card and the team's timeout buttons. Ten
 * players fit an iPhone 13 with no scroll; more scroll inside the half, never the page.
 */
export function TeamHalf({ side, tone, isUs, roster, team, period, onPick, onTeamPlay, onBench, onTimeout }: Props) {
  const t = TONE[tone];
  const fouls = team.teamFoulsForBonus(period);
  const kinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const border = { ok: t.ok, warn: 'border-amber-400', out: 'border-red-500' } as const;
  return (
    <section role="region" aria-label={side} class={`flex min-h-0 flex-col overflow-y-auto ${t.half}`}>
      <div class={`sticky top-0 z-[1] flex h-7 shrink-0 items-center justify-between gap-1 px-2 ${t.half}`}>
        <span class="flex items-center gap-1 text-sm font-bold">
          {side}
          {isUs && <span class={`rounded border px-1 text-[10px] leading-4 font-bold ${t.tag}`}>US</span>}
        </span>
        <span class={`whitespace-nowrap text-xs font-semibold ${teamFoulsWarn(fouls) ? t.foulsWarn : ''}`}>Team fouls {fouls}</span>
      </div>
      <div class="flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
        <div class="grid grid-cols-2 gap-1.5">
          {roster.map((p, i) => {
            const line = team.players[i];
            const state = line?.foulState ?? 'ok';
            const pf = line?.fouls ?? 0;
            const points = line?.points ?? 0;
            // An out player's number, name and points are grayed so a tap on the card reads as a mistake
            // before it is one. The red border, red dots and OUT stay at full strength: graying the whole
            // card took OUT to 2.2:1.
            const dim = state === 'out' ? 'opacity-50' : '';
            return (
              <button
                key={p.id}
                type="button"
                class={`min-h-16 min-w-0 rounded-lg border-2 px-1.5 py-1 text-left ${t.card} ${border[state]}`}
                onClick={() => onPick(p)}
                aria-label={`${`#${p.number} ${p.name}`.trim()}, ${countText(points, 'point', 'points')}, ${countText(pf, 'foul', 'fouls')}${state === 'out' ? ', out' : ''}`}
              >
                <div class={`flex items-baseline justify-between gap-1 ${dim}`}>
                  <span class="text-2xl font-bold leading-none">{p.number}</span>
                  <span class="text-base font-semibold leading-none tabular-nums">{points}</span>
                </div>
                <div class={`truncate text-xs leading-4 ${t.name} ${dim}`}>{p.name || ' '}</div>
                <div class="flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      class={`h-2 w-2 rounded-full ${n >= pf ? t.dotEmpty : state === 'out' ? 'bg-red-500' : state === 'warn' ? 'bg-amber-400' : t.dotOk}`}
                    />
                  ))}
                  {state === 'out' && <span class={`ml-0.5 text-[10px] font-bold leading-none ${t.outText}`}>OUT</span>}
                </div>
              </button>
            );
          })}
        </div>
        {/* The controls sit at the foot of the half, in the same place whatever the roster size. */}
        <div class="mt-auto flex flex-col gap-1.5">
          {/* A play for the team with no player picked. Task 8 adds the Whose number? prompt after the play. */}
          <button
            type="button"
            class={`min-h-8 rounded-lg border-2 border-dashed border-slate-500 px-2 text-sm font-bold ${t.dashed}`}
            onClick={onTeamPlay}
          >
            + Play
          </button>
          {/* Named for what it records, so it is not read as "edit the bench/roster". Half a card's height. */}
          <button
            type="button"
            class={`flex min-h-8 items-center justify-between gap-1 rounded-lg border-2 border-dashed px-2 text-xs font-bold ${t.dashed} ${team.benchTechs > 0 ? 'border-amber-400' : 'border-slate-500'}`}
            aria-label={`${BENCH_CARD_TEXT}${team.benchTechs > 0 ? `, ${countText(team.benchTechs, 'tech', 'techs')}` : ''}`}
            onClick={onBench}
          >
            <span class="truncate">{BENCH_CARD_TEXT}</span>
            {team.benchTechs > 0 && (
              <span class={`shrink-0 ${t.foulsWarn}`} data-testid="bench-techs">
                {countText(team.benchTechs, 'tech', 'techs')}
              </span>
            )}
          </button>
          {/* One tap takes the timeout. A count at zero draws grayed but stays tappable (Task 8 adds the guard). */}
          <div class={`grid gap-1.5 ${kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {kinds.map((k) => {
              const left = timeoutsLeft(team.timeouts, k);
              return (
                <button
                  key={k}
                  type="button"
                  class={`min-h-10 rounded-lg border border-b-4 px-1 text-sm font-bold shadow-sm active:translate-y-px ${t.timeout} ${left <= 0 ? 'opacity-50' : ''}`}
                  onClick={() => onTimeout(k)}
                >
                  {timeoutButtonText(k, left)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
