import { HOWTO_SECTIONS } from './howto-content';
import type { GameStore } from './store';

export function HowTo({ store }: { store: GameStore }) {
  const { setView, howtoReturn } = store;
  return (
    <main class="flex min-h-0 flex-1 flex-col">
      <header class="flex items-center gap-3 p-3">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 bg-slate-800 px-4 font-semibold" onClick={() => setView(howtoReturn)}>
          Back
        </button>
        <h1 class="text-xl font-bold">How to use</h1>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {HOWTO_SECTIONS.map((s) => (
          <section key={s.id} aria-label={s.title} class="mb-5">
            <h2 class="text-lg font-bold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} class="mt-1 text-slate-200">{p}</p>
            ))}
            {s.image && <img src={s.image.src} alt={s.image.alt} class="mt-2 w-full rounded-lg border border-slate-700" />}
            {s.id === 'wrong' && <p class="mt-3 text-center text-xs text-slate-400">v{__APP_VERSION__}</p>}
          </section>
        ))}
      </div>
    </main>
  );
}
