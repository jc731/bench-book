import { useState } from 'preact/hooks';
import { loadPrefs, savePrefs, type Prefs } from '../core/storage';
import type { GameStore } from './store';

/**
 * D15: per-device settings that may change or go away, in the prefs key of the current mode (demo or
 * real), never in the game or roster. Opened from the foot of Live's More; Back returns to Live.
 */
function Toggle({ id, label, text, on, onToggle }: { id: string; label: string; text: string; on: boolean; onToggle: () => void }) {
  return (
    <div class="mt-4 flex items-center gap-3 rounded-lg bg-slate-800 p-3">
      <div class="min-w-0 flex-1">
        <p id={`${id}-label`} class="font-semibold">{label}</p>
        <p id={`${id}-text`} class="text-sm text-slate-300">{text}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-text`}
        class={`min-h-11 min-w-16 shrink-0 rounded-lg border px-3 font-semibold ${on ? 'border-sky-400 bg-sky-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`}
        onClick={onToggle}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

export function Experiments({ store }: { store: GameStore }) {
  const { storage, keys, setView } = store;
  const [prefs, setPrefs] = useState(() => loadPrefs(storage, keys));
  const save = (next: Prefs) => {
    savePrefs(storage, next, keys);
    setPrefs(next);
  };
  const toggleClock = () => {
    save({ ...prefs, timeoutClock: !prefs.timeoutClock });
    if (prefs.timeoutClock) store.setClock(null); // turning the experiment off closes an open clock
  };
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
        <Toggle id="exp-clock" label="Timeout clock" text="Taking a timeout opens a 60 or 30 second clock. On Android the phone buzzes at half time and at 0, and the clock closes 10 seconds after 0." on={prefs.timeoutClock} onToggle={toggleClock} />
        <Toggle
          id="exp-us-left"
          label="Our team on the left"
          text="Off: Home on the left, Away on the right. On: your team on the left, home or away. Colors stay with Home and Away."
          on={prefs.usLeft}
          onToggle={() => save({ ...prefs, usLeft: !prefs.usLeft })}
        />
      </div>
    </main>
  );
}
