import { EndGame } from './EndGame';
import { HowTo } from './HowTo';
import { Live } from './Live';
import { Log } from './Log';
import { Reconcile, StatusChip } from './Reconcile';
import { RunningScore } from './RunningScore';
import { Setup } from './Setup';
import { useGameStore } from './store';
import { registerUpdates } from './sw-update';

registerUpdates();

export function App() {
  const store = useGameStore();
  const { saving, view } = store;

  return (
    <div class="flex h-dvh flex-col overflow-hidden bg-slate-900 text-white">
      {!saving && (
        <div class="bg-amber-400 px-4 py-3 text-center font-semibold text-slate-900" role="alert">
          Not saving on this device — keep the paper book current.
        </div>
      )}
      {view === 'setup' && (
        <div class="min-h-0 flex-1 overflow-y-auto">
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
