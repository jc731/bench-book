import { useRef, useState } from 'preact/hooks';
import { derive, oppPointsRecorded } from '../core/derive';
import { periodLabel, spanLabel } from '../core/periods';
import { checkPeriod, saveReconcile, totalProblem } from '../core/reconcile';
import { appendEvent, homeSide, rosterOf, sideName } from '../core/events';
import { checkSeed, setCheckDraft } from '../core/drafts';
import type { Player, Side } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { FeedbackLine } from './FeedbackLine';
import { addedLabel } from './log-logic';
import { NO_NUMBER, feedbackLine, namedWho, who, type PlayType, type Toast } from './live-logic';
import { Log } from './Log';
import {
  MISMATCH_HINT, appHasText, compareText, isMismatch, theirScoreLineIfRecorded, foulSidesOf, sawMismatch, oppPlaceholder, parseScore, reconcileDraftToSave, statusChipText,
} from './reconcile-logic';
import type { GameStore } from './store';

const sheetBtn = 'min-h-12 min-w-0 truncate rounded-xl bg-slate-600 px-3 text-left text-lg font-bold active:bg-slate-500';
const sheetOn = 'bg-white text-slate-900';

const field =
  'min-h-12 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-xl text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none';

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


export function Reconcile({ store }: { store: GameStore }) {
  const { game, reconcilePeriod, reconcileReturn, update, quiet, undo, redo, toast, setView } = store;
  const period = reconcilePeriod ?? 1;
  const [usText, setUsText] = useState('');
  const [oppText, setOppText] = useState('');
  const [note, setNote] = useState('');
  const [addStep, setAddStep] = useState<'closed' | 'player' | 'play'>('closed');
  const [addPlayer, setAddPlayer] = useState<Player | null>(null);
  // The team Add play records for; it opens on ours, so a one-team scorer taps no more than before.
  const [addSide, setAddSide] = useState<Side>('us');
  const seeded = useRef<number | null>(null);
  // The feedback present when Add play opened: its sheet shows only what came after it.
  const addOpenedWith = useRef<Toast | null>(null);
  // The feedback present when the check opened (End Q1 · Undo): it stays behind, so it does not cover the plays.
  const openedWith = useRef<Toast | null>(null);
  // The app's points over the checked span when the check was first opened (kept through Later in the
  // draft): a book number that disagreed with it was a mismatch, even if the plays were fixed before Save.
  const appAtOpen = useRef<number | null>(null);

  // Seed the fields once per period from the draft Later left, else the saved record. The opponent
  // box is never prefilled from taps: a number in it must be one the scorer read off the book.
  if (game && seeded.current !== period) {
    seeded.current = period;
    openedWith.current = toast;
    const seed = checkSeed(game, period);
    appAtOpen.current = seed.appSpanAtOpen;
    setUsText(seed.us);
    setNote(seed.note);
    setOppText(seed.opp);
  }

  if (!game) return null;
  const d = derive(game);
  const c = checkPeriod(game, period);
  const us = parseScore(usText);
  const opp = parseScore(oppText);
  const invalid = us.kind === 'invalid' || opp.kind === 'invalid';
  const bookUsTotal = us.kind === 'ok' ? us.value : null;
  const bookOppTotal = opp.kind === 'ok' ? opp.value : null;
  // A running score never goes down: a total below an earlier quarter's (or above a later one's) is a typo.
  const usProblem = totalProblem(game, period, bookUsTotal, 'bookUsTotal');
  const oppProblem = totalProblem(game, period, bookOppTotal, 'bookOppTotal');
  const blocked = invalid || usProblem !== null || oppProblem !== null;
  const live = usProblem ? null : compareText(bookUsTotal, c);
  const recorded = oppPointsRecorded(game);
  // Gated on their points being recorded: a scorer who records nothing for the other team may still type their book
  // total, and warning "app 0 — 22 off" every quarter would be noise.
  const theirs = oppProblem ? null : theirScoreLineIfRecorded(c, bookOppTotal, recorded);
  const mismatch = !usProblem && isMismatch(bookUsTotal, c);
  const span = spanLabel(c.spanFrom, period);
  // Home first, then Away; with no plays or roster for the other team, only ours, as before.
  const foulSides = foulSidesOf(game);
  const both = foulSides.length > 1;

  // Only Save saves; the comparison above it is live. A save that would change nothing is skipped,
  // so repeating it adds no undo step.
  const save = (): boolean => {
    if (blocked) return false;
    const draft = { bookUsTotal, bookOppTotal, note };
    const saw = sawMismatch(bookUsTotal === null ? null : bookUsTotal - c.anchorBook, appAtOpen.current);
    // Save retires any draft, even when the record itself does not change.
    quiet((g, now) => setCheckDraft(g, period, null, now));
    update(
      (g, now) => {
        const rec = reconcileDraftToSave(g.periods.find((p) => p.period === period), draft);
        return rec ? saveReconcile(g, period, rec.bookUsTotal, rec.bookOppTotal, rec.note, now, saw) : g;
      },
      `Saved ${periodLabel(period)} check`,
    );
    return true;
  };
  const addPlay = (type: PlayType) => {
    update(
      (g, now) => appendEvent(g, { type, ...(addPlayer ? { playerId: addPlayer.id } : {}), ...(addSide === 'them' ? { side: 'them' as const } : {}), period }, now),
      addedLabel(type, who(addPlayer, sideName(game, addSide)), period),
    );
    if (type !== 'FTM' && type !== 'FTX') closeAdd();
  };
  const closeAdd = () => { setAddStep('closed'); setAddPlayer(null); setAddSide('us'); };
  const saveAndClose = () => {
    if (save()) setView(reconcileReturn);
  };
  // Later keeps what was typed as a draft (not a check); with every field blank it keeps nothing.
  const later = () => {
    const draft = { us: usText, opp: oppText, note, appSpanAtOpen: appAtOpen.current ?? c.appSpan };
    quiet((g, now) => setCheckDraft(g, period, draft, now));
    setView(reconcileReturn);
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex min-h-15 shrink-0 items-center gap-3 border-b border-slate-700 px-3 py-2">
        <h1 class="text-xl font-bold">Check {periodLabel(period)}</h1>
        <span class="ml-auto rounded border border-slate-500 px-2 py-1 text-sm font-semibold text-slate-200" data-testid="check-status">{statusChipText(c.status)}</span>
      </header>

      {/* Clear of the fixed bar (64px) and the feedback line above it (44px, more when an entry wraps). */}
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pb-36">
        <p class="font-semibold text-white" data-testid="app-has">{appHasText(game, period)}</p>

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Our game score after {periodLabel(period)} (the book's running score)</span>
          <input
            class={field}
            inputMode="numeric"
            value={usText}
            onInput={(e) => setUsText(e.currentTarget.value)}
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Their game score after {periodLabel(period)}</span>
          <input
            class={field}
            inputMode="numeric"
            placeholder={oppPlaceholder(c, recorded)}
            value={oppText}
            onInput={(e) => setOppText(e.currentTarget.value)}
          />
        </label>
        {invalid && <p class="font-semibold text-red-300" role="alert">Whole numbers only, no minus sign.</p>}
        {!invalid && (usProblem || oppProblem) && (
          <p class="font-semibold text-red-300" role="alert">
            {usProblem ? `Ours: ${usProblem}.` : ''} {oppProblem ? `Theirs: ${oppProblem}.` : ''}
          </p>
        )}

        {live && (
          <div class={`rounded-lg px-3 py-3 ${mismatch ? 'bg-amber-400 text-slate-900' : 'bg-emerald-800'}`}>
            <p class="text-lg font-bold" role="status" data-testid="compare">{live}</p>
            {mismatch && <p class="mt-1 text-sm font-semibold" data-testid="compare-hint">{MISMATCH_HINT}</p>}
          </div>
        )}
        {theirs && <p class={theirs.warn ? 'font-semibold text-amber-300' : 'text-slate-300'} data-testid="compare-opp">{theirs.text}</p>}

        {/* Always offered: a missed foul never moves the score, so it is caught here after the score matches. */}
        <section aria-label="Plays to fix">
          <h2 class="mb-2 font-bold">Fix the plays{span !== periodLabel(period) && ` in ${span}`}</h2>
          <button
            type="button"
            class="mb-2 min-h-11 w-full rounded-lg border border-slate-500 px-4 font-semibold"
            onClick={() => { addOpenedWith.current = toast; setAddSide('us'); setAddStep('player'); }}
          >
            Add play to {periodLabel(period)}
          </button>
          <div class="flex h-[50dvh] flex-col overflow-hidden rounded-lg border border-slate-700">
            <Log store={store} period={period} fromPeriod={c.spanFrom} order="oldest" showToast={false} embedded />
          </div>
        </section>

        <label class="flex flex-col gap-1">
          <span class="text-sm text-slate-300">Note</span>
          <textarea class={`${field} text-base`} rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>

        <section aria-label="Fouls">
          <h2 class="font-bold">Fouls (compare with the book by eye)</h2>
          {foulSides.map((side) => (
            <p key={side} class="text-slate-300">
              Team fouls in {periodLabel(period)}{both && ` (${sideName(game, side)})`}: <span class="font-bold text-white">{(side === 'us' ? d.us : d.opp).teamFoulsByPeriod[period] ?? 0}</span>
            </p>
          ))}
          {/* Game totals, as the book keeps each player's fouls: labeled, so they are not read as this quarter's (UX audit v0.6.0, F2). */}
          <h3 class="mt-2 text-sm text-slate-300">Player fouls, whole game</h3>
          <div aria-label="Player fouls, whole game">
            {foulSides.map((side) => {
              const lines = (side === 'us' ? d.us : d.opp).players;
              const byId = new Map(rosterOf(game, side).map((p) => [p.id, p]));
              return (
                <div key={side}>
                  {both && <h4 class="mt-1 text-sm font-semibold text-slate-300">{sideName(game, side)}</h4>}
                  <ul class="mt-1 grid grid-cols-2 gap-x-3" aria-label={both ? `${sideName(game, side)} player fouls, whole game` : 'Player fouls, whole game'}>
                    {lines.map((l) => {
                      const p = byId.get(l.playerId);
                      return (
                        <li key={l.playerId} class="flex justify-between border-b border-slate-800 py-1">
                          <span class="truncate">#{p?.number} {p?.name}</span>
                          <span class="font-bold">{l.fouls}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {addStep === 'player' && (
        <Sheet title={`Add play to ${periodLabel(period)}`} onClose={closeAdd}>
          <div class="flex max-h-[65dvh] flex-col gap-3 overflow-y-auto">
            <div role="group" aria-label="Team">
              <h3 class="mb-1 text-sm font-semibold text-slate-300">Team</h3>
              <div class="grid grid-cols-2 gap-2">
                {(['Home', 'Away'] as const).map((tag) => {
                  const side: Side = (tag === 'Home') === (homeSide(game) === 'us') ? 'us' : 'them';
                  return (
                    <button key={tag} type="button" class={`${sheetBtn} ${addSide === side ? sheetOn : ''}`} onClick={() => setAddSide(side)}>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              {rosterOf(game, addSide).map((p) => (
                <button key={p.id} type="button" class={sheetBtn} onClick={() => { setAddPlayer(p); setAddStep('play'); }}>
                  #{p.number} {p.name}
                </button>
              ))}
              <button type="button" class={sheetBtn} onClick={() => { setAddPlayer(null); setAddStep('play'); }}>
                {NO_NUMBER}
              </button>
            </div>
          </div>
        </Sheet>
      )}
      {addStep === 'play' && (
        <EventSheet
          player={addPlayer}
          title={namedWho(addPlayer, sideName(game, addSide))}
          toast={toast === addOpenedWith.current ? null : toast}
          onPlay={addPlay}
          onUndo={undo}
          onRedo={redo}
          onClose={closeAdd}
        />
      )}

      {toast && toast !== openedWith.current && (
        <FeedbackLine line={feedbackLine(null, null, toast)} class="fixed inset-x-0 bottom-16 z-10 border-t border-slate-600" onUndo={undo} onRedo={redo} />
      )}
      <div class="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-slate-700 bg-slate-950 p-2">
        <button type="button" class="min-h-12 flex-1 rounded-lg border border-slate-400 font-semibold" onClick={later}>
          Later
        </button>
        <button type="button" class="min-h-12 flex-1 rounded-lg bg-white font-semibold text-slate-900 disabled:opacity-40" disabled={blocked} onClick={saveAndClose}>
          Save
        </button>
      </div>
    </div>
  );
}
