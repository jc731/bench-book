import { useEffect, useRef, useState } from 'preact/hooks';
import type { TeamDerived } from '../core/derive';
import type { Lineup } from '../core/lineup';
import { isOvertime } from '../core/periods';
import type { Player, TimeoutKind } from '../core/types';
import { BENCH_CARD_TEXT, SETTLE_MS, countText, shownLayout, subButtonText, teamFoulsWarn, timeoutButtonText, timeoutsLeft, type TeamTag } from './live-logic';

interface Props {
  side: TeamTag;
  /** The team's name for the header (`halfName`), or null to show the side alone. */
  name: string | null;
  /** Home is light (the home team traditionally wears white), Away dark. */
  tone: 'light' | 'dark';
  /** Our team's half carries the US tag. */
  isUs: boolean;
  roster: Player[];
  team: TeamDerived;
  /** Who is on the floor, and the card order (it changes at a sub and at an activity swap). */
  lineup: Lineup;
  /** Changes when the order must show at once (a sub recorded or undone, another game), not after a pause. */
  settleKey: string;
  period: number;
  onPick: (p: Player) => void;
  /** The dashed + Play card: a play for this team with no player picked. */
  onTeamPlay: () => void;
  onBench: () => void;
  /** The Sub button, beside + Play. */
  onSub: () => void;
  onTimeout: (kind: TimeoutKind) => void;
}

// One job per color (README § Colors) on both tones. An element whose border shows a state (a card,
// Bench) gets exactly one border-color class: two on one element resolve by stylesheet order, not class order. The warn, out and bench-tech colors differ by tone because
// amber-400 and red-500 sit under 3:1 on a white card; the light shades are amber-600 and red-600.
// Every card is solid (D1); a card after the top five takes the `rest` fill, one step toward the half's
// background (D2). On the light half amber-600 is 2.92:1 on that fill, under 3:1, so a rest card's warn
// shades are amber-700.
const TONE = {
  light: {
    half: 'bg-slate-200 text-slate-900',
    card: 'bg-white active:bg-slate-100',
    rest: 'bg-slate-100 active:bg-slate-200',
    ok: 'border-slate-600',
    warn: 'border-amber-600',
    restWarn: 'border-amber-700',
    out: 'border-red-600',
    dotWarn: 'bg-amber-600',
    restDotWarn: 'bg-amber-700',
    dotOut: 'bg-red-600',
    benchTech: 'border-amber-700',
    name: 'text-slate-600',
    dotEmpty: 'border border-slate-400',
    dotOk: 'bg-slate-700',
    outText: 'text-red-600',
    dashed: 'bg-slate-100 active:bg-slate-300',
    tag: 'border-slate-700 text-slate-700',
    foulsWarn: 'text-amber-800',
    timeout: 'border-slate-400 bg-white active:bg-slate-100',
    subOk: 'border-slate-500',
  },
  dark: {
    half: 'bg-slate-900 text-white',
    card: 'bg-slate-800 active:bg-slate-700',
    rest: 'bg-[#172033] active:bg-slate-700',
    ok: 'border-slate-400',
    warn: 'border-amber-400',
    restWarn: 'border-amber-400',
    out: 'border-red-500',
    dotWarn: 'bg-amber-400',
    restDotWarn: 'bg-amber-400',
    dotOut: 'bg-red-500',
    benchTech: 'border-amber-400',
    name: 'text-slate-300',
    dotEmpty: 'border border-slate-500',
    dotOk: 'bg-slate-300',
    outText: 'text-red-400',
    dashed: 'bg-slate-900 active:bg-slate-700',
    tag: 'border-white text-white',
    foulsWarn: 'text-amber-300',
    timeout: 'border-slate-500 bg-slate-700 active:bg-slate-600',
    subOk: 'border-slate-500',
  },
} as const;

/** With this many players or more, the floor block stays put and only the bench scrolls (decision 11a). */
const SPLIT_AT = 11;

/**
 * One team's half of the live screen: a header (team, US tag, team fouls), its player cards in two
 * columns in the lineup's order (the top five, then the rest a fill step grayer or darker, out as out), then + Play beside the Sub
 * button, the half-height Bench card and the team's timeout buttons. Ten players fit an iPhone 13 with
 * no scroll; with 11 or more the first five cards stay in view and the rest scroll in their own region.
 */
export function TeamHalf({ side, name, tone, isUs, roster, team, lineup, settleKey, period, onPick, onTeamPlay, onBench, onSub, onTimeout }: Props) {
  const t = TONE[tone];
  const fouls = team.teamFoulsForBonus(period);
  const kinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const subText = subButtonText(lineup);
  const index = new Map(roster.map((p, i) => [p.id, i]));
  // Display order is the lineup's layout, but an activity swap waits for a pause in tapping, so a card
  // never moves under the scorer's thumb (a free-throw pair, a foul then the shooter). A sub shows at once.
  const layout = useSettledLayout(lineup.layout, settleKey);
  const ordered = layout.filter((id) => index.has(id)).map((id) => index.get(id)!);
  const split = lineup.tracked && roster.length >= SPLIT_AT;

  const cardFor = (i: number, pos: number) => {
    const p = roster[i];
    const line = team.players[i];
    const state = line?.foulState ?? 'ok';
    const pf = line?.fouls ?? 0;
    const points = line?.points ?? 0;
    const onFloor = lineup.floor.includes(p.id);
    const rest = state !== 'out' && pos >= lineup.layoutFloor;
    // An out player's number, name and points are grayed so a tap on the card reads as a mistake
    // before it is one. The red border, red dots and OUT stay at full strength: graying the whole
    // card took OUT to 2.2:1.
    const dim = state === 'out' ? 'opacity-50' : '';
    // One solid box for every card, so a promoted player's card never changes size. One border-color class per card.
    const box = `border-2 px-1 py-1 ${rest ? t.rest : t.card} ${state === 'out' ? t.out : state === 'warn' ? (rest ? t.restWarn : t.warn) : t.ok}`;
    return (
      <button
        key={p.id}
        type="button"
        class={`min-h-15 min-w-0 rounded-lg text-left ${box}`}
        onClick={() => onPick(p)}
        aria-label={`${`#${p.number} ${p.name}`.trim()}, ${countText(points, 'point', 'points')}, ${countText(pf, 'foul', 'fouls')}${state === 'out' ? ', out' : onFloor ? '' : ', bench'}`}
      >
        <div class={`flex items-baseline justify-between gap-1 ${dim}`}>
          <span class="text-2xl font-bold leading-none">{p.number}</span>
          <span class="text-base font-semibold leading-none tabular-nums">{points}</span>
        </div>
        <div class={`truncate text-xs leading-4 ${t.name} ${dim}`}>{p.name || ' '}</div>
        {/* The dots row is exactly a dot tall, so OUT (10px, centered) never changes a card's height. */}
        <div class="flex h-2 items-center gap-px" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <span
              key={n}
              class={`h-2 w-2 shrink-0 rounded-full ${n >= pf ? t.dotEmpty : state === 'out' ? t.dotOut : state === 'warn' ? (rest ? t.restDotWarn : t.dotWarn) : t.dotOk}`}
            />
          ))}
          {state === 'out' && <span class={`ml-0.5 text-[10px] font-bold leading-none ${t.outText}`}>OUT</span>}
        </div>
      </button>
    );
  };

  const grid = (ids: number[], offset = 0) => <div class="grid grid-cols-2 gap-1.5">{ids.map((i, k) => cardFor(i, offset + k))}</div>;

  return (
    <section
      role="region"
      aria-label={side}
      class={`flex min-h-0 flex-col ${split ? 'overflow-hidden' : 'overflow-y-auto'} ${t.half}`}
    >
      <div class={`sticky top-0 z-[1] flex h-7 shrink-0 items-center justify-between gap-1 px-2 ${t.half}`}>
        {/* A typed name shows under a small Home/Away tag (audit 0.11.0 F3): two lines, 10 + 16 px, in the
            same 28 px row with 1 px to spare above and below, so the cards never move. The name truncates; the tags and Team fouls never shrink. */}
        <span class="flex min-w-0 items-center gap-1" data-testid="half-title">
          {name === null ? (
            <span class="shrink-0 text-sm font-bold">{side}</span>
          ) : (
            <span class="flex min-w-0 flex-col">
              <span class={`text-[10px] leading-[10px] font-semibold ${t.name}`}>{side}</span>
              <span class="truncate text-sm leading-4 font-bold">{name}</span>
            </span>
          )}
          {isUs && <span class={`shrink-0 rounded border px-1 text-[10px] leading-4 font-bold ${t.tag}`}>US</span>}
        </span>
        <span class={`shrink-0 whitespace-nowrap text-xs font-semibold ${teamFoulsWarn(fouls) ? t.foulsWarn : ''}`}>Team fouls {fouls}</span>
      </div>
      <div class={`flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5 ${split ? 'min-h-0' : ''}`}>
        {split ? (
          <>
            {/* The floor as the layout was frozen (the starters, or the floor at the last sub, 5 or not) stays in view. */}
            <div class="shrink-0">{grid(ordered.slice(0, lineup.layoutFloor))}</div>
            {/* A promoted player stays where they are in here until the next sub regroups the half. */}
            <div class="min-h-0 flex-1 overflow-y-auto" data-testid="bench-region">
              {grid(ordered.slice(lineup.layoutFloor), lineup.layoutFloor)}
            </div>
          </>
        ) : (
          grid(ordered)
        )}
        {/* The controls sit at the foot of the half, in the same place whatever the roster size. */}
        <div class="mt-auto flex shrink-0 flex-col gap-1.5">
          <div class="flex gap-1.5">
            {/* A play for the team with no player picked; Whose number? follows the play unless Stop asking is set. */}
            <button
              type="button"
              class={`min-h-11 flex-1 rounded-lg border-2 border-dashed border-slate-500 px-1 text-sm font-bold ${t.dashed}`}
              onClick={onTeamPlay}
            >
              + Play
            </button>
            {subText !== null && (
              <button
                type="button"
                class={`min-h-11 flex-1 whitespace-nowrap rounded-lg border-2 px-1 text-sm font-bold ${t.card} ${t.subOk}`}
                onClick={onSub}
              >
                {subText}
              </button>
            )}
          </div>
          {/* Named for what it records, so it is not read as "edit the bench/roster". Half a card's height. */}
          <button
            type="button"
            class={`flex min-h-8 items-center justify-between gap-1 rounded-lg border-2 border-dashed px-2 text-xs font-bold ${t.dashed} ${team.benchTechs > 0 ? t.benchTech : 'border-slate-500'}`}
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

/**
 * The layout to draw: `target` once nobody has touched the screen for SETTLE_MS, else the last one
 * drawn. A change of `key` shows `target` at once. Any pointerdown anywhere restarts the wait.
 */
function useSettledLayout(target: string[], key: string): string[] {
  const [shown, setShown] = useState(target);
  const [shownKey, setShownKey] = useState(key);
  const latest = useRef(target);
  latest.current = target;
  const immediate = shownKey !== key;
  const targetSig = target.join(',');
  useEffect(() => {
    if (immediate) {
      setShown(target);
      setShownKey(key);
      return;
    }
    if (shown.join(',') === targetSig) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShown(latest.current), SETTLE_MS);
    };
    arm();
    document.addEventListener('pointerdown', arm, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', arm, true);
    };
  }, [targetSig, key, shown.join(',')]);
  return immediate ? target : shownLayout(shown, target);
}
