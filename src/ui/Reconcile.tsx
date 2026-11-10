import { useEffect, useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { periodLabel } from '../core/periods';
import { checkPeriod, saveReconcile } from '../core/reconcile';
import { Log } from './Log';
import { compareText, cumulativeThrough, parseScore, statusChipText } from './reconcile-logic';
import type { GameStore } from './store';

const TOAST_MS = 4000;
const field =
  'min-h-12 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-xl text-white focus:border-amber-400 focus:outline-none';

/** Status chip for a period; opens that period's Reconcile view. */
export function StatusChip({ store, period }: { store: GameStore; period: number }) {
  const { game, setReconcilePeriod, setView } = store;
  if (!game) return null;
  const status = checkPeriod(game, period).status;
  const tone =
    status === 'unresolved' ? 'bg-amber-400 text-slate-900'
    : status === 'pending' ? 'bg-slate-600 text-white'
    : 'bg-emerald-700 text-white';
  return (
    <button
      type="button"
      class={`min-h-11 rounded-lg px-3 text-sm font-semibold ${tone}`}
      onClick={() => { setReconcilePeriod(period); setView('reconcile'); }}
    >
      {statusChipText(status)}
    </button>
  );
}

const asText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function Reconcile({ store }: { store: GameStore }) {
  const { game, reconcilePeriod, update, undo, toast, clearToast, setView } = store;
  const period = reconcilePeriod ?? 1;
  const [usText, setUsText] = useState('');
  const [oppText, setOppText] = useState('');
  const [note, setNote] = useState('');
  const [showLog, setShowLog] = useState(true);
  const seeded = useRef<number | null>(null);

  // Seed the drafts once per period from the saved record (opponent prefilled from taps when tracked).
  if (game && seeded.current !== period) {
    seeded.current = period;
    const c = checkPeriod(game, period);
    setUsText(asText(c.bookUs));
    setNote(c.note);
    setOppText(asText(c.bookOpp ?? (game.trackOpponentTaps && c.oppTapped > 0 ? c.oppTapped : null)));
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!game) return null;
  const d = derive(game);
  const c = checkPeriod(game, period);
  const us = parseScore(usText);
  const opp = parseScore(oppText);
  const invalid = us.kind === 'invalid' || opp.kind === 'invalid';
  const bookUs = us.kind === 'ok' ? us.value : null;
  const bookOpp = opp.kind === 'ok' ? opp.value : null;
  const live = compareText(bookUs, c.appUs);
  const mismatch = bookUs !== null && bookUs !== c.appUs;
  const byId = new Map(game.roster.map((p) => [p.id, p]));

  // Saves as soon as a book number is entered, so a mismatch is remembered and a later fix reads "fixed".
  // A save that would change nothing is skipped, so repeating it adds no undo step.
  const save = (): boolean => {
    if (invalid) return false;
    const saved = game.periods.find((p) => p.period === period);
    const same = saved
      ? saved.bookUs === bookUs && saved.bookOpp === bookOpp && saved.note === note
      : bookUs === null && bookOpp === null && note === '';
    if (!same) {
      update((g, now) => saveReconcile(g, period, bookUs, bookOpp, note, now), `Saved ${periodLabel(period)} check`);
    }
    return true;
  };
  const saveAndClose = () => {
    if (save()) setView('live');
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={() => setView('live')}>
          Later
        </button>
        <h1 class="text-xl font-bold">Check {periodLabel(period)}</h1>
        <span class="ml-auto rounded bg-slate-700 px-2 py-1 text-sm font-semibold">{statusChipText(c.status)}</span>
      </header>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pb-24">
        <p class="text-slate-300">
          Running score through {periodLabel(period)}: <span class="font-bold text-white">App {cumulativeThrough(game, period)}</span>
        </p>

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Our points in {periodLabel(period)} (book's Score by Qtr box)</span>
          <input
            class={field}
            inputMode="numeric"
            value={usText}
            onInput={(e) => setUsText(e.currentTarget.value)}
            onBlur={save}
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Opponent points in {periodLabel(period)}</span>
          <input
            class={field}
            inputMode="numeric"
            value={oppText}
            onInput={(e) => setOppText(e.currentTarget.value)}
            onBlur={save}
          />
        </label>
        {invalid && <p class="font-semibold text-red-300" role="alert">Whole numbers only, no minus sign.</p>}

        {live && (
          <p
            class={`rounded-lg px-3 py-3 text-lg font-bold ${mismatch ? 'bg-amber-400 text-slate-900' : 'bg-emerald-800'}`}
            role="status"
            data-testid="compare"
          >
            {live}
          </p>
        )}
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={save}>
          Check
        </button>

        {mismatch && (
          <section aria-label="Plays to fix">
            <div class="flex items-center justify-between">
              <h2 class="font-bold">Fix the plays</h2>
              <button type="button" class="min-h-11 px-3 font-semibold text-amber-300" onClick={() => setShowLog(!showLog)}>
                {showLog ? 'Hide' : 'Show'}
              </button>
            </div>
            {showLog && (
              <div class="flex h-[50dvh] flex-col overflow-hidden rounded-lg border border-slate-700">
                <Log store={store} period={period} onClose={() => setShowLog(false)} showToast={false} />
              </div>
            )}
          </section>
        )}

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Note</span>
          <textarea class={`${field} text-base`} rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} onBlur={save} />
        </label>

        <section aria-label="Fouls">
          <h2 class="font-bold">Fouls (compare with the book by eye)</h2>
          <p class="text-slate-300">Team fouls in {periodLabel(period)}: <span class="font-bold text-white">{d.teamFoulsByPeriod[period] ?? 0}</span></p>
          <ul class="mt-1 grid grid-cols-2 gap-x-3">
            {d.players.map((l) => {
              const p = byId.get(l.playerId);
              return (
                <li key={l.playerId} class="flex justify-between border-b border-slate-800 py-1">
                  <span class="truncate">#{p?.number} {p?.name}</span>
                  <span class="font-bold">{l.fouls}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {toast && (
        <div class="fixed inset-x-0 bottom-16 z-10 flex items-center justify-between gap-2 border-t border-slate-600 bg-slate-700 px-3 py-1" role="status">
          <span class="truncate font-semibold">{toast.text}</span>
          {toast.canUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={undo}>Undo</button>
          )}
        </div>
      )}
      <div class="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-slate-700 bg-slate-950 p-2">
        <button type="button" class="min-h-12 flex-1 rounded-lg border border-slate-400 font-semibold" onClick={() => setView('live')}>
          Later
        </button>
        <button type="button" class="min-h-12 flex-1 rounded-lg bg-white font-semibold text-slate-900 disabled:opacity-40" disabled={invalid} onClick={saveAndClose}>
          Save
        </button>
      </div>
    </div>
  );
}
