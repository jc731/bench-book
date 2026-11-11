import { useEffect, useState } from 'preact/hooks';
import { newGame } from '../core/events';
import { clearRoster, loadRoster, saveRoster } from '../core/storage';
import type { GameInfo, Player } from '../core/types';
import { notExportedText } from './reconcile-logic';
import { MAX_PLAYERS, validateRoster } from './roster';
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

function isIos(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
  return ios && !nav.standalone;
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
  const [track, setTrack] = useState(false);
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
    const clean = roster.map((p) => ({
      ...p,
      number: p.number.trim(),
      name: (p.name ?? '').trim(),
      pos: (p.pos ?? '').trim(),
    }));
    saveRoster(storage, clean);
    store.start({
      ...newGame({ ...info, opponent: info.opponent.trim() }, clean, new Date()),
      trackOpponentTaps: track,
    });
  };

  if (game && confirming) {
    return (
      <main class="mx-auto max-w-xl p-4">
        <h1 class="mb-4 text-2xl font-bold">Bench Book</h1>
        <div class="rounded-xl border border-amber-400 bg-slate-800 p-4">
          <p class="mb-4 text-lg">
            A game is in progress (vs {game.info.opponent}). Export it first?
          </p>
          {notExportedText(game, new Date()) && (
            <p class="mb-4 font-semibold text-amber-300" role="alert">{notExportedText(game, new Date())}</p>
          )}
          <div class="flex flex-col gap-3">
            <button class={`${btn} bg-amber-400 text-slate-900`} onClick={() => store.setView('end')}>
              Export
            </button>
            <button
              class={`${btn} border border-red-400 bg-slate-900 text-red-300`}
              onClick={() => {
                store.discard();
                setConfirming(false);
              }}
            >
              Discard and start new
            </button>
            <button class={secondary} onClick={() => store.setView('live')}>
              Cancel
            </button>
          </div>
        </div>
        <p class="mt-6 text-center text-xs text-slate-400">v{__APP_VERSION__}</p>
      </main>
    );
  }

  return (
    <main class="mx-auto max-w-xl p-4 pb-24">
      <h1 class="mb-4 text-2xl font-bold">New game</h1>
      <UpdateBanner />

      <section class="mb-6 flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Opponent (required)</span>
          <input class={input} value={info.opponent} onInput={(e) => setField('opponent', e.currentTarget.value)} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Date</span>
          <input type="date" class={input} value={info.date} onInput={(e) => setField('date', e.currentTarget.value)} />
        </label>
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="Home or away">
          {(['home', 'away'] as const).map((h) => (
            <button
              type="button"
              aria-pressed={info.homeAway === h}
              class={`${btn} border ${info.homeAway === h ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`}
              onClick={() => setField('homeAway', h)}
            >
              {h === 'home' ? 'Home' : 'Away'}
            </button>
          ))}
        </div>
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
      </section>

      <section class="mb-4">
        <h2 class="mb-2 text-lg font-semibold">
          Roster <span class="text-sm font-normal text-slate-300">({roster.length}/{MAX_PLAYERS})</span>
        </h2>
        <div class="flex flex-col gap-2">
          {roster.map((p, i) => (
            <div class="flex items-center gap-2">
              <input
                class={`${input} w-16! min-w-0 shrink-0`}
                aria-label={`Player ${i + 1} position`}
                placeholder="POS"
                value={p.pos}
                onInput={(e) => setPlayer(p.id, 'pos', e.currentTarget.value)}
              />
              <input
                class={`${input} min-w-0 flex-1`}
                aria-label={`Player ${i + 1} name`}
                placeholder="Name"
                value={p.name}
                onInput={(e) => setPlayer(p.id, 'name', e.currentTarget.value)}
              />
              <input
                class={`${input} w-[4.5rem]! min-w-0 shrink-0`}
                aria-label={`Player ${i + 1} number`}
                placeholder="#"
                inputMode="numeric"
                value={p.number}
                onInput={(e) => setPlayer(p.id, 'number', e.currentTarget.value)}
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
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class={secondary}
            disabled={roster.length >= MAX_PLAYERS}
            onClick={() => setRoster((r) => [...r, blankPlayer()])}
          >
            Add player
          </button>
          <button
            type="button"
            class={secondary}
            onClick={() => {
              clearRoster(storage);
              setRoster([blankPlayer()]);
            }}
          >
            Clear saved roster
          </button>
        </div>
      </section>

      {tried && errors.length > 0 && (
        <ul class="mb-4 rounded-lg border border-red-400 bg-slate-800 p-3 text-red-300" role="alert">
          {errors.map((e) => (
            <li>{e}</li>
          ))}
        </ul>
      )}

      {isIos() && (
        <p class="mb-4 text-sm text-slate-300">
          Tip: Share → Add to Home Screen keeps your roster saved between games.
        </p>
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
      <p class="mt-6 text-center text-xs text-slate-400">v{__APP_VERSION__}</p>
    </main>
  );
}
