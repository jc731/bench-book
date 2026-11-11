import { useEffect, useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { periodLabel } from '../core/periods';
import { checkPeriod, saveReconcile } from '../core/reconcile';
import { appendEvent } from '../core/events';
import type { Player } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { addedLabel } from './log-logic';
import type { PlayType } from './live-logic';
import { Log } from './Log';
import {
  MISMATCH_HINT, appHasText, compareText, oppCompareText, sawMismatch, oppPlaceholder, parseScore, reconcileDraftToSave, statusChipText,
} from './reconcile-logic';
import type { GameStore } from './store';

const TOAST_MS = 4000;
const field =
  'min-h-12 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-xl text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none';

/** Status chip for a period; opens that period's Reconcile view. */
export function StatusChip({ store, period }: { store: GameStore; period: number }) {
  const { game, openReconcile } = store;
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
      onClick={() => openReconcile(period, 'log')}
    >
      {statusChipText(status)}
    </button>
  );
}

const asText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function Reconcile({ store }: { store: GameStore }) {
  const { game, reconcilePeriod, reconcileReturn, update, undo, toast, clearToast, setView } = store;
  const period = reconcilePeriod ?? 1;
  const [usText, setUsText] = useState('');
  const [oppText, setOppText] = useState('');
  const [note, setNote] = useState('');
  const [showLog, setShowLog] = useState(true);
  const [addStep, setAddStep] = useState<'closed' | 'player' | 'play'>('closed');
  const [addPlayer, setAddPlayer] = useState<Player | null>(null);
  const seeded = useRef<number | null>(null);
  // The app's count when the check opened: a book number that disagreed with it was a mismatch,
  // even if the plays were fixed on this screen before Save.
  const appAtOpen = useRef<number | null>(null);

  // Seed the drafts once per period from the saved record. The opponent box is never prefilled
  // from taps: a number in it must be one the scorer read off the book.
  if (game && seeded.current !== period) {
    seeded.current = period;
    const c = checkPeriod(game, period);
    appAtOpen.current = c.appUs;
    setUsText(asText(c.bookUs));
    setNote(c.note);
    setOppText(asText(c.bookOpp));
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
  const oppLive = live || bookOpp !== null ? oppCompareText(bookOpp, c.oppTapped, game.trackOpponentTaps) : null;
  const mismatch = bookUs !== null && bookUs !== c.appUs;
  const byId = new Map(game.roster.map((p) => [p.id, p]));

  // Only Save saves; the comparison above it is live. A save that would change nothing is skipped,
  // so repeating it adds no undo step.
  const save = (): boolean => {
    if (invalid) return false;
    const draft = { bookUs, bookOpp, note };
    const saw = sawMismatch(bookUs, appAtOpen.current);
    update(
      (g, now) => {
        const rec = reconcileDraftToSave(g.periods.find((p) => p.period === period), draft);
        return rec ? saveReconcile(g, period, rec.bookUs, rec.bookOpp, rec.note, now, saw) : g;
      },
      `Saved ${periodLabel(period)} check`,
    );
    return true;
  };
  const addPlay = (type: PlayType) => {
    if (!addPlayer) return;
    update((g, now) => appendEvent(g, { type, playerId: addPlayer.id, period }, now), addedLabel(type, addPlayer.number, period));
    if (type !== 'FTM' && type !== 'FTX') closeAdd();
  };
  const closeAdd = () => { setAddStep('closed'); setAddPlayer(null); };
  const saveAndClose = () => {
    if (save()) setView(reconcileReturn);
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex min-h-15 shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
        <h1 class="text-xl font-bold">Check {periodLabel(period)}</h1>
        <span class="ml-auto rounded bg-slate-700 px-2 py-1 text-sm font-semibold">{statusChipText(c.status)}</span>
      </header>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pb-24">
        <p class="font-semibold text-white" data-testid="app-has">{appHasText(game, period)}</p>

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Our points in {periodLabel(period)} (book's Score by Qtr box)</span>
          <input
            class={field}
            inputMode="numeric"
            value={usText}
            onInput={(e) => setUsText(e.currentTarget.value)}
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Opponent points in {periodLabel(period)}</span>
          <input
            class={field}
            inputMode="numeric"
            placeholder={oppPlaceholder(c.oppTapped, game.trackOpponentTaps)}
            value={oppText}
            onInput={(e) => setOppText(e.currentTarget.value)}
          />
        </label>
        {invalid && <p class="font-semibold text-red-300" role="alert">Whole numbers only, no minus sign.</p>}

        {live && (
          <div class={`rounded-lg px-3 py-3 ${mismatch ? 'bg-amber-400 text-slate-900' : 'bg-emerald-800'}`}>
            <p class="text-lg font-bold" role="status" data-testid="compare">{live}</p>
            {mismatch && <p class="mt-1 text-sm font-semibold" data-testid="compare-hint">{MISMATCH_HINT}</p>}
          </div>
        )}
        {oppLive && <p class="text-slate-300" data-testid="compare-opp">{oppLive}</p>}

        {mismatch && (
          <section aria-label="Plays to fix">
            <div class="flex items-center justify-between">
              <h2 class="font-bold">Fix the plays</h2>
              <button type="button" class="min-h-11 px-3 font-semibold text-amber-300" onClick={() => setShowLog(!showLog)}>
                {showLog ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              type="button"
              class="mb-2 min-h-11 w-full rounded-lg border border-slate-500 px-4 font-semibold"
              onClick={() => setAddStep('player')}
            >
              Add play to {periodLabel(period)}
            </button>
            {showLog && (
              <div class="flex h-[50dvh] flex-col overflow-hidden rounded-lg border border-slate-700">
                <Log store={store} period={period} showToast={false} embedded />
              </div>
            )}
          </section>
        )}

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Note</span>
          <textarea class={`${field} text-base`} rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
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

      {addStep === 'player' && (
        <Sheet title={`Add play to ${periodLabel(period)}`} onClose={closeAdd}>
          <div class="grid max-h-[60dvh] grid-cols-2 gap-2 overflow-y-auto">
            {game.roster.map((p) => (
              <button
                key={p.id}
                type="button"
                class="min-h-12 min-w-0 truncate rounded-xl bg-slate-600 px-3 text-left text-lg font-bold active:bg-slate-500"
                onClick={() => { setAddPlayer(p); setAddStep('play'); }}
              >
                #{p.number} {p.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {addStep === 'play' && addPlayer && (
        <EventSheet player={addPlayer} toast={toast} onPlay={addPlay} onUndo={undo} onClose={closeAdd} />
      )}

      {toast && (
        <div class="fixed inset-x-0 bottom-16 z-10 flex items-center justify-between gap-2 border-t border-slate-600 bg-slate-700 px-3 py-1" role="status">
          <span class="truncate font-semibold">{toast.text}</span>
          {toast.canUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={undo}>Undo</button>
          )}
        </div>
      )}
      <div class="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-slate-700 bg-slate-950 p-2">
        <button type="button" class="min-h-12 flex-1 rounded-lg border border-slate-400 font-semibold" onClick={() => setView(reconcileReturn)}>
          Later
        </button>
        <button type="button" class="min-h-12 flex-1 rounded-lg bg-white font-semibold text-slate-900 disabled:opacity-40" disabled={invalid} onClick={saveAndClose}>
          Save
        </button>
      </div>
    </div>
  );
}
