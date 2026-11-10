import { Live } from './Live';
import { Setup } from './Setup';
import { useGameStore } from './store';

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
      {view !== 'setup' && view !== 'live' && (
        <main class="min-h-0 flex-1 overflow-y-auto p-4">
          <h1 class="text-2xl font-bold">Bench Book</h1>
          <p class="mt-2 text-slate-300">
            {gameLabel(store.game?.info.opponent)} — {view === 'reconcile' ? 'Reconcile: coming soon' : `the ${view} view arrives in a later task`}.
          </p>
          <button class="mt-4 min-h-11 rounded-lg border border-slate-500 px-4" onClick={() => store.setView('live')}>
            Back
          </button>
        </main>
      )}
    </div>
  );
}

function gameLabel(opponent?: string): string {
  return opponent ? `Game vs ${opponent}` : 'No game';
}
