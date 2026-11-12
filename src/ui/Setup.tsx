import { useEffect, useState } from 'preact/hooks';
import { newGame } from '../core/events';
import { clearRoster, loadPrefs, loadRoster, saveRoster, savePrefs } from '../core/storage';
import type { GameInfo, Player } from '../core/types';
import { isExported } from '../core/reconcile';
import { notExportedText } from './reconcile-logic';
import { cleanRoster, MAX_PLAYERS, validateRoster } from './roster';
import { Sheet } from './EventSheet';
import { getStorage, type GameStore } from './store';
import { applyUpdate, onUpdateWaiting, updateWaiting } from './sw-update';

const input =
  'min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-base text-white placeholder:text-slate-400 focus:border-amber-400 focus:outline-none';
const btn = 'min-h-11 rounded-lg px-4 font-semibold';
const secondary = `${btn} border border-slate-500 bg-slate-800 text-white`;

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function blankPlayer(): Player {
  return { id: crypto.randomUUID(), number: '', name: '', pos: '' };
}

function UpdateBanner() {
  const [ready, setReady] = useState(updateWaiting());
  useEffect(() => onUpdateWaiting(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <button class={`${secondary} mb-4 w-full border-amber-400 text-amber-300`} onClick={applyUpdate}>
      Update available — reload
    </button>
  );
}

export function Setup({ store }: { store: GameStore }) {
  const { storage } = getStorage();
  const { game } = store;
  const [roster, setRoster] = useState<Player[]>(() => {
    const saved = loadRoster(storage);
    return saved.length ? saved : [blankPlayer()];
  });
  const [info, setInfo] = useState<GameInfo>({
    team: '',
    opponent: '',
    date: today(),
    homeAway: 'home',
    coach: '',
    scorer: '',
    timer: '',
  });
  const [track, setTrack] = useState(() => loadPrefs(storage).trackOpponentTaps);
  const [clearing, setClearing] = useState(false);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(game !== null);

  const setField = (k: keyof GameInfo, v: string) => setInfo((i) => ({ ...i, [k]: v }));
  const setPlayer = (id: string, k: keyof Player, v: string) =>
    setRoster((r) => r.map((p) => (p.id === id ? { ...p, [k]: v } : p)));

  const errors = [
    ...(info.opponent.trim() === '' ? ['Opponent is required.'] : []),
    ...validateRoster(roster),
  ];

  const onStart = () => {
    setTried(true);
    if (errors.length) return;
    const clean = cleanRoster(roster);
    saveRoster(storage, clean);
    savePrefs(storage, { trackOpponentTaps: track });
    store.start({
      ...newGame({ ...info, opponent: info.opponent.trim() }, clean, new Date()),
      trackOpponentTaps: track,
    });
  };

  const discardAndStart = () => {
    store.discard();
    setConfirming(false);
  };

  if (game && confirming) {
    const exported = isExported(game);
    const warning = notExportedText(game, new Date());
    const exportBtn = { label: 'Export', onClick: () => store.setView('end') };
    const discardBtn = { label: 'Discard and start new', onClick: discardAndStart };
    // Exported: discarding loses nothing, so it is the amber primary. Not exported: Export is, and
    // Discard reads as the danger it is.
    const primary = `${btn} bg-amber-400 text-slate-900`;
    const danger = `${btn} border border-red-400 bg-slate-900 text-red-300`;
    const [first, second] = exported
      ? [{ ...discardBtn, class: primary }, { ...exportBtn, class: secondary }]
      : [{ ...exportBtn, class: primary }, { ...discardBtn, class: danger }];
    return (
      <main class="mx-auto max-w-xl p-4">
        <h1 class="mb-4 text-2xl font-bold">Bench Book</h1>
        <div class="rounded-xl border border-amber-400 bg-slate-800 p-4">
          <p class="mb-4 text-lg">
            A game is in progress (vs {game.info.opponent}).{exported ? '' : ' Export it first?'}
          </p>
          {exported ? (
            <p class="mb-4 font-semibold text-emerald-300">Exported ✓</p>
          ) : (
            warning && (
              <p class="mb-4 font-semibold text-amber-300" role="alert">{warning}</p>
            )
          )}
          <div class="flex flex-col gap-3">
            {[first, second].map((b) => (
              <button key={b.label} class={b.class} onClick={b.onClick}>
                {b.label}
              </button>
            ))}
            <button class={secondary} onClick={() => store.setView('live')}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main class="mx-auto max-w-xl p-4 pb-24">
      <h1 class="mb-4 text-2xl font-bold">New game</h1>
      <UpdateBanner />

      <button
        type="button"
        class="mb-4 min-h-11 text-left text-base text-amber-300 underline"
        onClick={() => store.openHowto('setup')}
      >
        First time here? How to use
      </button>

      <div class="mb-6 flex items-end gap-2">
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm text-slate-300">Opponent (required)</span>
          <input class={input} value={info.opponent} onInput={(e) => setField('opponent', e.currentTarget.value)} />
        </label>
        <div class="flex shrink-0" role="group" aria-label="Home or away">
          {(['home', 'away'] as const).map((h) => (
            <button
              type="button"
              aria-pressed={info.homeAway === h}
              class={`min-h-11 border px-3 font-semibold ${h === 'home' ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'} ${info.homeAway === h ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`}
              onClick={() => setField('homeAway', h)}
            >
              {h === 'home' ? 'Home' : 'Away'}
            </button>
          ))}
        </div>
      </div>

      <section class="mb-4">
        <h2 class="mb-2 text-lg font-semibold">
          Roster <span class="text-sm font-normal text-slate-300">({roster.length}/{MAX_PLAYERS})</span>
        </h2>
        <div class="flex flex-col gap-2">
          {roster.map((p, i) => (
            <div class="flex items-center gap-2">
              <input
                class={`${input} w-[4.5rem]! min-w-0 shrink-0`}
                aria-label={`Player ${i + 1} number`}
                placeholder="#"
                inputMode="numeric"
                value={p.number}
                onInput={(e) => setPlayer(p.id, 'number', e.currentTarget.value)}
              />
              <input
                class={`${input} min-w-0 flex-1`}
                aria-label={`Player ${i + 1} name`}
                placeholder="Name"
                value={p.name}
                onInput={(e) => setPlayer(p.id, 'name', e.currentTarget.value)}
              />
              <button
                type="button"
                class="h-11 w-11 shrink-0 rounded-lg border border-slate-500 bg-slate-800 text-xl text-white"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => setRoster((r) => r.filter((x) => x.id !== p.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div class="mt-3">
          <button
            type="button"
            class={secondary}
            disabled={roster.length >= MAX_PLAYERS}
            onClick={() => setRoster((r) => [...r, blankPlayer()])}
          >
            Add player
          </button>
        </div>
      </section>

      <details class="mb-6 rounded-lg border border-slate-600 bg-slate-800/50 p-3">
        <summary class="min-h-11 cursor-pointer py-2 font-semibold">Game details</summary>
        <div class="mt-2 flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-slate-300">Date</span>
            <input type="date" class={input} value={info.date} onInput={(e) => setField('date', e.currentTarget.value)} />
          </label>
          {(
            [
              ['team', 'Our team'],
              ['coach', 'Coach'],
              ['scorer', 'Scorer'],
              ['timer', 'Timekeeper'],
            ] as const
          ).map(([k, label]) => (
            <label class="flex flex-col gap-1">
              <span class="text-sm text-slate-300">{label} (optional)</span>
              <input class={input} value={info[k]} onInput={(e) => setField(k, e.currentTarget.value)} />
            </label>
          ))}
          <label class="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              class="h-6 w-6 accent-amber-400"
              checked={track}
              onChange={(e) => setTrack(e.currentTarget.checked)}
            />
            <span>Also keep their score (Opp +1/+2/+3)</span>
          </label>
          <button type="button" class={`${secondary} self-start`} onClick={() => setClearing(true)}>
            Clear saved roster
          </button>
        </div>
      </details>

      {tried && errors.length > 0 && (
        <ul class="mb-4 rounded-lg border border-red-400 bg-slate-800 p-3 text-red-300" role="alert">
          {errors.map((e) => (
            <li>{e}</li>
          ))}
        </ul>
      )}

      <div class="flex flex-col gap-3">
        <button class={`${btn} bg-amber-400 text-lg text-slate-900`} onClick={onStart}>
          Start game
        </button>
        {game && (
          <button class={secondary} onClick={() => store.setView('live')}>
            Cancel
          </button>
        )}
      </div>
      {clearing && (
        <Sheet title="Clear the saved roster from this device?" onClose={() => setClearing(false)}>
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class={`${btn} border border-red-400 bg-slate-900 text-red-300`}
              onClick={() => {
                clearRoster(storage);
                setRoster([blankPlayer()]);
                setClearing(false);
              }}
            >
              Clear
            </button>
            <button type="button" class={secondary} onClick={() => setClearing(false)}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
