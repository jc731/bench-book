import { useEffect, useState } from 'preact/hooks';
import { newGame } from '../core/events';
import { clearRoster, loadRoster, saveRoster } from '../core/storage';
import type { GameInfo, Player } from '../core/types';
import { isExported } from '../core/reconcile';
import { notExportedText } from './reconcile-logic';
import { cleanOppRoster, defaultOpponent, opponentOrDefault, validateOppRoster } from './roster';
import { blankPlayer, RosterEditor } from './RosterEditor';
import { Sheet } from './EventSheet';
import { getStorage, type GameStore } from './store';
import { applyUpdate, onUpdateWaiting, updateWaiting } from './sw-update';

const input =
  'min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-base text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none';
const btn = 'min-h-11 rounded-lg px-4 font-semibold';
const secondary = `${btn} border border-slate-500 bg-slate-800 text-white`;

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function UpdateBanner() {
  const [ready, setReady] = useState(updateWaiting());
  useEffect(() => onUpdateWaiting(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <button class={`${secondary} mb-4 w-full border-sky-400 text-sky-300`} onClick={applyUpdate}>
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
  const [oppRoster, setOppRoster] = useState<Player[]>(() => [blankPlayer()]);
  const [clearing, setClearing] = useState(false);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(game !== null);

  const setField = (k: keyof GameInfo, v: string) => setInfo((i) => ({ ...i, [k]: v }));

  // Both rosters are optional; fully blank rows are dropped before validating and saving.
  const errors = [...new Set([...validateOppRoster(roster), ...validateOppRoster(oppRoster)])];

  const onStart = () => {
    setTried(true);
    if (errors.length) return;
    const clean = cleanOppRoster(roster);
    // Ours prefills the next game; theirs is deliberately not saved.
    saveRoster(storage, clean);
    store.start({
      ...newGame(
        { ...info, opponent: opponentOrDefault(info.opponent, info.date) },
        clean,
        new Date(),
        cleanOppRoster(oppRoster),
      ),
      // Task 6 removes the dependency: until the live screen shows both teams, the Opp +1/+2/+3 row stays on.
      trackOpponentTaps: true,
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
    // Exported: discarding loses nothing, so it is the white primary. Not exported: Export is, and
    // Discard reads as the danger it is.
    const primary = `${btn} bg-white text-slate-900`;
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
        class="mb-4 min-h-11 text-left text-base text-sky-300 underline"
        onClick={() => store.openHowto('setup')}
      >
        First time here? How to use
      </button>

      <div class="mb-6 flex" role="group" aria-label="Home or away">
        {(['home', 'away'] as const).map((h) => (
          <button
            type="button"
            aria-pressed={info.homeAway === h}
            class={`min-h-11 flex-1 border px-3 font-semibold ${h === 'home' ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'} ${info.homeAway === h ? 'border-sky-400 bg-sky-400 text-slate-900' : 'border-slate-500 bg-slate-800 text-white'}`}
            onClick={() => setField('homeAway', h)}
          >
            {h === 'home' ? 'Home' : 'Away'}
          </button>
        ))}
      </div>

      <RosterEditor label="Roster" players={roster} onChange={setRoster} idPrefix="Player" />
      <RosterEditor label="Their roster (optional)" players={oppRoster} onChange={setOppRoster} idPrefix="Their player" />

      <details class="mb-6 rounded-lg border border-slate-600 bg-slate-800/50 p-3">
        <summary class="min-h-11 cursor-pointer py-2 font-semibold">Game details</summary>
        <div class="mt-2 flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-slate-300">Opponent (optional)</span>
            <input
              class={input}
              aria-describedby="opponent-hint"
              value={info.opponent}
              onInput={(e) => setField('opponent', e.currentTarget.value)}
            />
            {/* A gray "11-16" in the field read as a score (UX audit v0.6.0, F5), so the default is said in words. */}
            <span id="opponent-hint" class="text-sm text-slate-400">Left blank, the game is named {defaultOpponent(info.date)}</span>
          </label>
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
        <button class={`${btn} bg-white text-lg text-slate-900`} onClick={onStart}>
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
