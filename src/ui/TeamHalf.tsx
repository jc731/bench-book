import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { TeamDerived } from '../core/derive';
import type { Lineup } from '../core/lineup';
import { isOvertime } from '../core/periods';
import type { Player, TimeoutKind } from '../core/types';
import {
  BENCH_CARD_TEXT, FLASH_SWAP_MS, FLASH_TAP_MS, SETTLE_MS, countText, movedUp, movedUpText, numberAreaLabel, quickLabel, rowGroupLabel,
  scrollBackAllowed, shownLayout, subButtonText, swapGuarded, teamFoulsWarn, timeoutButtonText, timeoutsLeft, type QuickPlay, type TeamTag,
} from './live-logic';

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
  /** Who is on the floor, and the row order (it changes at a sub and at an activity swap). */
  lineup: Lineup;
  /** Changes when the order must show at once (a sub recorded or undone, another game), not after a pause. */
  settleKey: string;
  period: number;
  /** The number area: the player's popup (every play, fixes, subs). */
  onPick: (p: Player) => void;
  /** A row's +2 or Foul: one tap, one play (Live drops a double tap and opens the popup for an out player). */
  onQuick: (p: Player, type: QuickPlay) => void;
  /** The dashed + Play button: a play for this team with no player picked. */
  onTeamPlay: () => void;
  onBench: () => void;
  /** The Sub button, beside + Play. */
  onSub: () => void;
  onTimeout: (kind: TimeoutKind) => void;
}

// One job per color (docs/colors.md) on both tones. An element whose border shows a state (the
// bench-tech button) gets exactly one border-color class: two on one element resolve by stylesheet
// order, not class order. A row's state is its inset ring, again one ring-color class per row. The
// warn, out and bench-tech colors differ by tone because amber-400 and red-500 sit under 3:1 on a
// white row; the light shades are amber-600 and red-600. A row after the top block takes the `rest`
// fill, one step toward the half's background (D2). On the light half amber-600 is 2.92:1 on that
// fill, under 3:1, so a rest row's warn shades are amber-700. The flash (blue's second job: a row
// just recorded or moved) changes the fill only, never the ring, so a 4th-foul amber shows at once.
const TONE = {
  light: {
    half: 'bg-slate-200 text-slate-900',
    card: 'bg-white',
    rest: 'bg-slate-100',
    flash: 'bg-sky-100',
    ringWarn: 'ring-amber-600',
    restRingWarn: 'ring-amber-700',
    ringOut: 'ring-red-600',
    // While a row flashes its ring keeps 3:1 on the flash fill: amber-600 on sky-100 is 2.78:1, amber-700
    // 4.40:1; red-600 on sky-100 is 4.15:1 (measured 2026-11-24, WCAG formula on Tailwind 4 oklch).
    flashRingWarn: 'ring-amber-700',
    flashRingOut: 'ring-red-600',
    // +2 is filled and Foul outlined, the same border, so they differ by shape, not by a state color.
    quick: 'border-slate-500 bg-slate-200 active:bg-slate-300',
    quickOutline: 'border-slate-500 bg-transparent active:bg-slate-200',
    fade: 'from-slate-200',
    dotWarn: 'bg-amber-600',
    restDotWarn: 'bg-amber-700',
    benchTech: 'border-amber-700',
    name: 'text-slate-600',
    dotEmpty: 'border border-slate-400',
    dotOk: 'bg-slate-700',
    outText: 'text-red-600',
    dashed: 'bg-slate-100 active:bg-slate-300',
    tag: 'border-slate-700 text-slate-700',
    foulsWarn: 'text-amber-800',
    timeout: 'border-slate-400 bg-white active:bg-slate-100',
    subOk: 'border-slate-500 bg-white active:bg-slate-100',
  },
  dark: {
    half: 'bg-slate-900 text-white',
    card: 'bg-slate-800',
    rest: 'bg-[#172033]',
    flash: 'bg-sky-900',
    ringWarn: 'ring-amber-400',
    restRingWarn: 'ring-amber-400',
    ringOut: 'ring-red-500',
    // On sky-900: amber-400 5.5:1; red-500 2.48:1, so red-400 (3.27:1; 5.07:1 on slate-800, 5.62:1 on the rest fill).
    flashRingWarn: 'ring-amber-400',
    flashRingOut: 'ring-red-400',
    quick: 'border-slate-400 bg-slate-600 active:bg-slate-500',
    quickOutline: 'border-slate-400 bg-transparent active:bg-slate-700',
    fade: 'from-slate-900',
    dotWarn: 'bg-amber-400',
    restDotWarn: 'bg-amber-400',
    benchTech: 'border-amber-400',
    name: 'text-slate-300',
    dotEmpty: 'border border-slate-500',
    dotOk: 'bg-slate-300',
    outText: 'text-red-400',
    dashed: 'bg-slate-900 active:bg-slate-700',
    tag: 'border-white text-white',
    foulsWarn: 'text-amber-300',
    timeout: 'border-slate-500 bg-slate-700 active:bg-slate-600',
    subOk: 'border-slate-500 bg-slate-800 active:bg-slate-700',
  },
} as const;

/**
 * One team's half of the live screen (1.1): a header (team, US tag, team fouls), then one row per
 * player in the lineup's order, in a list that scrolls inside the half (the top block first, then the
 * rest a fill step toward the background, after an 8 px gap). A row is the jersey number with the
 * player's points and foul dots (tap it for the popup: +3, free throws, techs, fixes, subs) and two
 * one-tap buttons, +2 and Foul. Under the list, in the same place whatever the roster size: + Play,
 * Sub and Tech on one row, then the team's timeout buttons.
 *
 * An activity swap waits for a pause (SETTLE_MS); when it shows, the moved rows flash, the half
 * scrolls its list back to the top (unless the scorer scrolled it by hand just now), a hidden status
 * line names who moved up, and the half's +2 and Foul ignore taps for SWAP_GUARD_MS.
 */
export function TeamHalf({ side, name, tone, isUs, roster, team, lineup, settleKey, period, onPick, onQuick, onTeamPlay, onBench, onSub, onTimeout }: Props) {
  const t = TONE[tone];
  const fouls = team.teamFoulsForBonus(period);
  const kinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const subText = subButtonText(lineup);
  const index = new Map(roster.map((p, i) => [p.id, i]));

  const listRef = useRef<HTMLDivElement>(null);
  const swapShownAt = useRef<number | null>(null);
  const lastHandScrollAt = useRef<number | null>(null);
  const holdTop = useRef<number | null>(null);
  const [swapText, setSwapText] = useState('');
  // Counts swaps that should scroll the list back to the top; the effect below does it after the render.
  const [scrollBack, setScrollBack] = useState(0);
  const [flash, flashFor] = useFlash();
  // Read inside the settle callback, which runs between renders.
  const now = useRef({ roster, top: lineup.layoutFloor });
  now.current = { roster, top: lineup.layoutFloor };

  // Display order is the lineup's layout, but an activity swap waits for a pause in tapping and
  // scrolling, so a row never moves under the scorer's thumb (a free-throw pair, a foul then the
  // shooter). A sub shows at once, and starts none of what follows.
  const layout = useSettledLayout(lineup.layout, settleKey, (before, after) => {
    const at = Date.now();
    const { roster: r, top } = now.current;
    swapShownAt.current = at;
    const up = movedUp(before, after, top);
    const down = movedUp(after, before, top);
    flashFor([...up, ...down], FLASH_SWAP_MS);
    const numbers = up.map((id) => r.find((p) => p.id === id)?.number).filter((n): n is string => n !== undefined);
    setSwapText(numbers.length > 0 ? movedUpText(numbers) : '');
    if (scrollBackAllowed(lastHandScrollAt.current, at)) setScrollBack((n) => n + 1);
    else holdTop.current = listRef.current?.scrollTop ?? null;
  });
  // Reordering the rows drops a scrolled list to the top (Chromium, measured 2026-11-24: scrollTop 412
  // to 0 on a swap), so a list held by a hand scroll is put back before the new order paints.
  useLayoutEffect(() => {
    if (holdTop.current !== null && listRef.current) listRef.current.scrollTop = holdTop.current;
    holdTop.current = null;
  }, [layout.join(',')]);
  // Back to the top once the new order is drawn: a smooth scroll started before the rows move is cut
  // short when they do (seen in the 2026-11-24 screenshots).
  useEffect(() => {
    if (scrollBack === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [scrollBack]);
  const ordered = layout.filter((id) => index.has(id)).map((id) => index.get(id)!);
  const handScroll = () => (lastHandScrollAt.current = Date.now());

  const rowFor = (i: number, pos: number) => {
    const p = roster[i];
    const line = team.players[i];
    const state = line?.foulState ?? 'ok';
    const pf = line?.fouls ?? 0;
    const points = line?.points ?? 0;
    const out = state === 'out';
    const onFloor = lineup.floor.includes(p.id);
    const rest = !out && pos >= lineup.layoutFloor;
    const flashing = flash.has(p.id);
    const fill = flashing ? t.flash : rest ? t.rest : t.card;
    // The ring shows through a flash (only the fill changes), in a shade that clears 3:1 on the flash fill.
    const ringColor = out ? (flashing ? t.flashRingOut : t.ringOut) : state === 'warn' ? (flashing ? t.flashRingWarn : rest ? t.restRingWarn : t.ringWarn) : null;
    const ring = ringColor ? `ring-2 ring-inset ${ringColor}` : '';
    // An out player's number and points are grayed so a tap reads as a mistake before it is one. The
    // red ring and OUT stay at full strength (graying a whole card once took OUT to 2.2:1), and so do
    // the +2 and Foul labels; their dashed border says they will not record.
    const dim = out ? 'opacity-50' : '';
    const quick = (type: QuickPlay, text: string, cls: string) => (
      <button
        type="button"
        class={`h-[52px] w-14 shrink-0 rounded-md border-2 text-lg font-bold ${out ? 'border-dashed' : ''} ${cls} ${type === 'FOUL' ? 'ml-3' : ''}`}
        aria-label={quickLabel(side, p.number, type)}
        onClick={() => {
          // A finger already reaching for a row must not land on the row a swap just slid in.
          if (swapGuarded(swapShownAt.current, Date.now())) return;
          if (!out) flashFor([p.id], FLASH_TAP_MS);
          onQuick(p, type);
        }}
      >
        {text}
      </button>
    );
    return (
      <div
        key={p.id}
        role="group"
        aria-label={rowGroupLabel(side, p.number, onFloor)}
        data-flash={flashing ? '1' : undefined}
        class={`flex h-14 shrink-0 items-center rounded-lg pr-1 ${fill} ${ring} ${pos > 0 && pos === lineup.layoutFloor ? 'mt-2' : ''}`}
      >
        <button
          type="button"
          class="flex h-full min-w-0 flex-1 flex-col justify-center pl-1.5 text-left"
          onClick={() => onPick(p)}
          aria-label={numberAreaLabel(p.number, points, pf, out)}
        >
          {/* The points sit top-right of the number area, smaller and gray, so "#3 0" never reads as 30. The
              area is about 53 px: a two-digit number and two-digit points fit side by side, with the dots below. */}
          <span class={`flex items-start justify-between ${dim}`}>
            <span class="text-[28px] font-bold leading-none">{p.number}</span>
            <span class={`ml-1 text-xs font-semibold leading-none tabular-nums ${t.name}`}>{points}</span>
          </span>
          {/* The dots row is exactly a dot tall, OUT included, so an out row never changes height. */}
          {out ? (
            <span class={`mt-1 flex h-2 items-center text-xs font-bold leading-none ${t.outText}`}>OUT</span>
          ) : (
            <span class="mt-1 flex h-2 items-center gap-0.5" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  class={`h-2 w-2 shrink-0 rounded-full ${n >= pf ? t.dotEmpty : state === 'warn' ? (rest ? t.restDotWarn : t.dotWarn) : t.dotOk}`}
                />
              ))}
            </span>
          )}
        </button>
        {quick('FG2', '+2', t.quick)}
        {quick('FOUL', 'Foul', t.quickOutline)}
      </div>
    );
  };

  return (
    <section role="region" aria-label={side} class={`flex min-h-0 flex-col overflow-hidden ${t.half}`}>
      <div class={`flex h-7 shrink-0 items-center justify-between gap-1 px-2 ${t.half}`}>
        {/* A typed name shows under a small Home/Away tag (audit 0.11.0 F3): two lines, 10 + 16 px, in the
            same 28 px row with 1 px to spare above and below, so the rows never move. The name truncates; the tags and Team fouls never shrink. */}
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
      <div role="status" class="sr-only" data-testid="swap-status">{swapText}</div>
      <div class="flex min-h-0 flex-1 flex-col gap-1.5 px-1 pb-1.5">
        <div class="relative min-h-0 flex-1">
          <div ref={listRef} class="h-full overflow-y-auto pb-4 [overflow-anchor:none]" data-testid="row-list" onTouchMove={handScroll} onWheel={handScroll}>
            <div class="flex flex-col gap-2">{ordered.map((i, pos) => rowFor(i, pos))}</div>
          </div>
          {/* A 16 px fade at the foot of the list: it scrolls. No "N more" counter. */}
          <div class={`pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t ${t.fade} to-transparent`} aria-hidden="true" />
        </div>
        {/* The controls sit at the foot of the half, in the same place whatever the roster size. */}
        <div class="flex shrink-0 flex-col gap-1.5">
          <div class="flex gap-1.5">
            {/* A play for the team with no player picked; Whose number? follows the play unless Stop asking is set. */}
            <button
              type="button"
              class={`min-h-11 min-w-0 flex-1 whitespace-nowrap rounded-lg border-2 border-dashed border-slate-500 px-1 text-xs font-bold ${t.dashed}`}
              onClick={onTeamPlay}
            >
              + Play
            </button>
            {subText !== null && (
              <button
                type="button"
                class={`min-h-11 min-w-0 flex-1 whitespace-nowrap rounded-lg border-2 px-1 text-xs font-bold ${t.subOk}`}
                onClick={onSub}
              >
                {subText}
              </button>
            )}
            {/* Reads Tech; its name says what it records, so it is not read as "edit the bench/roster". */}
            <button
              type="button"
              class={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 border-dashed px-1 text-xs font-bold ${t.dashed} ${team.benchTechs > 0 ? t.benchTech : 'border-slate-500'}`}
              aria-label={`${BENCH_CARD_TEXT}${team.benchTechs > 0 ? `, ${countText(team.benchTechs, 'tech', 'techs')}` : ''}`}
              onClick={onBench}
            >
              <span>Tech</span>
              {team.benchTechs > 0 && (
                <span class={`shrink-0 tabular-nums ${t.foulsWarn}`} data-testid="bench-techs">
                  {team.benchTechs}
                </span>
              )}
            </button>
          </div>
          {/* One tap takes the timeout. A count at zero draws grayed but stays tappable (it asks first). */}
          <div class={`grid gap-1.5 ${kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {kinds.map((k) => {
              const left = timeoutsLeft(team.timeouts, k);
              return (
                <button
                  key={k}
                  type="button"
                  class={`min-h-11 rounded-lg border border-b-4 px-1 text-sm font-bold shadow-sm active:translate-y-px ${t.timeout} ${left <= 0 ? 'opacity-50' : ''}`}
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

/** Rows that flash, each for its own time: a newer flash of a row restarts its timer. */
function useFlash(): [Set<string>, (ids: string[], ms: number) => void] {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, number>());
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const flashFor = (add: string[], ms: number) => {
    if (add.length === 0) return;
    setIds((s) => new Set([...s, ...add]));
    for (const id of add) {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => {
        timers.current.delete(id);
        setIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, ms));
    }
  };
  return [ids, flashFor];
}

/**
 * The layout to draw: `target` once nobody has touched or scrolled the screen for SETTLE_MS, else the
 * last one drawn. A change of `key` shows `target` at once. Any pointerdown or scroll anywhere restarts
 * the wait. `onSwap(before, after)` runs when the wait ends and the drawn order changes (an activity
 * swap, or an Undo's revert of one), never for a change of `key`.
 */
function useSettledLayout(target: string[], key: string, onSwap: (before: string[], after: string[]) => void): string[] {
  const [shown, setShown] = useState(target);
  const [shownKey, setShownKey] = useState(key);
  const latest = useRef(target);
  latest.current = target;
  const swap = useRef(onSwap);
  swap.current = onSwap;
  const immediate = shownKey !== key;
  const drawn = immediate ? target : shownLayout(shown, target);
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  const targetSig = target.join(',');
  useEffect(() => {
    if (immediate) {
      setShown(target);
      setShownKey(key);
      return;
    }
    if (shown.join(',') === targetSig) return;
    let timer = 0;
    let done = false;
    const stop = () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', arm, true);
      document.removeEventListener('scroll', arm, true);
    };
    const settle = () => {
      // Done before anything scrolls: the swap's own scroll back to the top must not re-arm the wait.
      done = true;
      stop();
      const before = drawnRef.current;
      const after = latest.current;
      setShown(after);
      if (before.join(',') !== after.join(',')) swap.current(before, after);
    };
    function arm() {
      if (done) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    }
    arm();
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('scroll', arm, true);
    return stop;
  }, [targetSig, key, shown.join(',')]);
  return drawn;
}
