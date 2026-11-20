import { useState } from 'preact/hooks';
import { loadPrefs, savePrefs } from '../core/storage';
import type { GameStore } from './store';

/**
 * D15: per-device settings that may change or go away, in the prefs key of the current mode (demo or
 * real), never in the game or roster. Opened from the foot of Live's More; Back returns to Live.
 */
export function Experiments({ store }: { store: GameStore }) {
  const { storage, keys, setView } = store;
  const [prefs, setPrefs] = useState(() => loadPrefs(storage, keys));
  const toggleClock = () => {
    const next = { ...prefs, timeoutClock: !prefs.timeoutClock };
    savePrefs(storage, next, keys);
    setPrefs(next);
  };
  const on = prefs.timeoutClock;
  return (
    <main class="flex min-h-0 flex-1 flex-col">
      <header class="flex items-center gap-3 p-3">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 bg-slate-800 px-4 font-semibold" onClick={() => setView('live')}>
          Back
        </button>
        <h1 class="text-xl font-bold">Experiments</h1>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <p class="text-slate-300">Settings on this phone only. They may change or go away.</p>
        <div class="mt-4 flex items-center gap-3 rounded-lg bg-slate-800 p-3">
          <div class="min-w-0 flex-1">
            <p id="exp-clock-label" class="font-semibold">Timeout clock</p>
            <p id="exp-clock-text" class="text-sm text-slate-300">Taking a timeout opens a 60 or 30 second clock.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="exp-clock-label"
            aria-describedby="exp-clock-text"
            class={`min-h-11 min-w-16 shrink-0 rounded-lg border px-3 font-semibold ${on ? 'border-sky-400 bg-sky-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`}
            onClick={toggleClock}
          >
            {on ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </main>
  );
}
