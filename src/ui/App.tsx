import { useEffect, useRef } from 'preact/hooks';
import { demoActive } from './demo';
import { EndGame } from './EndGame';
import { HowTo } from './HowTo';
import { Live } from './Live';
import { Log } from './Log';
import { Reconcile, StatusChip } from './Reconcile';
import { RunningScore } from './RunningScore';
import { Setup } from './Setup';
import { useGameStore } from './store';
import { registerUpdates } from './sw-update';
import { useWakeLock } from './wake-lock';

registerUpdates();

export function App() {
  const store = useGameStore();
  const { saving, view } = store;
  // D8: a tap is any button click while a game is open and the view is not Setup. One capturing
  // listener, added once; a ref-like closure over the latest store keeps it current.
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const onClick = (e: Event) => {
      const s = latest.current;
      if (s.game && s.view !== 'setup' && (e.target as Element | null)?.closest?.('button')) s.bump('taps');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  // The screen stays on through a live game on every view (Live, Log, a quarter check), not on Setup.
  useWakeLock(Boolean(store.game && !store.game.endedAt && view !== 'setup'));

  return (
    <div class="flex h-dvh flex-col overflow-hidden bg-slate-900 text-white">
      {/* In the flow, above everything: no screen's controls sit under it. Gray, so it adds no color job. */}
      {demoActive() && <div class="shrink-0 bg-slate-800 text-center text-xs leading-5 text-slate-400">Demo</div>}
      {!saving && (
        <div class="bg-amber-400 px-4 py-3 text-center font-semibold text-slate-900" role="alert">
          Not saving on this device — keep the paper book current.
        </div>
      )}
      {/* Setup stays mounted (hidden) under the How-to opened from it, so typed fields survive Back. */}
      {(view === 'setup' || (view === 'howto' && store.howtoReturn === 'setup')) && (
        <div class={view === 'setup' ? 'min-h-0 flex-1 overflow-y-auto' : 'hidden'}>
          <Setup store={store} />
        </div>
      )}
      {view === 'live' && <Live store={store} />}
      {view === 'log' && (
        <Log
          store={store}
          headerExtra={(p) => (store.game && (p < store.game.currentPeriod || store.game.endedAt) ? <StatusChip store={store} period={p} /> : null)}
        />
      )}
      {view === 'reconcile' && <Reconcile store={store} />}
      {view === 'end' && <EndGame store={store} />}
      {view === 'howto' && <HowTo store={store} />}
      {view === 'running' && <RunningScore store={store} />}
    </div>
  );
}
