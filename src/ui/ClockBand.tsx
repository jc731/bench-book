import { useEffect, useState } from 'preact/hooks';
import { clockLeftMs, clockPhase, clockText, pauseClock, resetClock, startClock, warnText, type Clock } from './clock-logic';

const btn = 'min-h-11 min-w-11 shrink-0 rounded-lg px-2 font-semibold';

/**
 * D17: the timeout clock, a band above the bottom bar in place of the feedback line, one row of at most
 * 56 px. It holds no time of its own (D18): every render reads the store's clock at `Date.now()`, and a
 * 250 ms tick re-renders it while it is on screen. D20: the time is white while running, amber in the
 * last half with the note, and red Time at 0. Nothing here touches the game (I7).
 */
export function ClockBand({ clock, setClock, class: cls = '' }: { clock: Clock; setClock: (c: Clock | null) => void; class?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();
  const phase = clockPhase(clock, now);
  const running = clock.endsAt !== null && phase !== 'time';
  const tone = phase === 'time' ? 'text-red-400' : phase === 'warn' ? 'text-amber-300' : 'text-white';
  const note = phase === 'time' ? 'Time' : phase === 'warn' ? warnText(clock) : '';
  return (
    <div role="timer" aria-label="Timeout clock" class={`flex h-14 items-center gap-2 bg-slate-800 px-3 ${cls}`}>
      <span data-testid="clock-time" class={`text-3xl font-bold tabular-nums ${tone}`}>{clockText(clockLeftMs(clock, now))}</span>
      <span data-testid="clock-note" class={`min-w-0 flex-1 truncate font-bold ${tone}`}>{note}</span>
      <button
        type="button"
        class={`${btn} w-16 border border-sky-400 text-sky-300 disabled:opacity-40`}
        disabled={phase === 'time'}
        onClick={() => setClock(running ? pauseClock(clock, Date.now()) : startClock(clock, Date.now()))}
      >
        {running ? 'Pause' : 'Start'}
      </button>
      <button type="button" class={`${btn} border border-slate-500`} onClick={() => setClock(resetClock(clock))}>
        Reset
      </button>
      <button type="button" class={`${btn} border border-slate-500 text-xl`} aria-label="Close clock" onClick={() => setClock(null)}>
        ×
      </button>
    </div>
  );
}
