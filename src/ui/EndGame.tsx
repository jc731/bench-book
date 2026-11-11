import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { exportFilename, playsCsv } from '../core/export-plays';
import { bookCsv } from '../core/export-book';
import { periodLabel } from '../core/periods';
import { checkPeriod, endGame, markExported, openIssues, oppTotal, reopenGame, saveReconcile } from '../core/reconcile';
import type { ExportKind } from '../core/types';
import { download } from './download';
import { Sheet } from './EventSheet';
import { EXPORT_DESCRIPTION, EXPORT_NAME, exportStateText, issueAction, statusChipText } from './reconcile-logic';
import type { GameStore } from './store';

const btn = 'min-h-12 w-full rounded-xl px-4 text-lg font-bold';

export function EndGame({ store }: { store: GameStore }) {
  const { game, update, setView, openReconcile } = store;
  // Fixed on arrival so a row does not vanish under the scorer's thumb once it gets a note. Ending the
  // game early makes the current quarter count, so the list is taken again when that changes.
  const issuePeriods = useRef<{ endedAt: string | undefined; periods: number[] } | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (!game) return null;
  if (!issuePeriods.current || issuePeriods.current.endedAt !== game.endedAt) {
    issuePeriods.current = { endedAt: game.endedAt, periods: openIssues(game).map((i) => i.period) };
  }
  const periods = issuePeriods.current.periods;
  const d = derive(game);

  const saveNote = (period: number) => {
    const c = checkPeriod(game, period);
    const text = notes[period] ?? c.note;
    if (text === c.note) return;
    update((g, now) => saveReconcile(g, period, c.bookUs, c.bookOpp, text, now), `Noted ${periodLabel(period)}`);
  };
  const reopen = (period: number) => openReconcile(period, 'end');
  const exportOne = (kind: ExportKind) => {
    download(exportFilename(game, kind), kind === 'book' ? bookCsv(game) : playsCsv(game));
    // A saved file is a fact, not an edit: no undo step.
    update((g, now) => markExported(g, kind, now), `Exported ${EXPORT_NAME[kind]}`, { undoable: false });
  };
  const endNow = () => {
    update((g, now) => endGame(g, now), 'End game');
    setConfirmEnd(false);
  };
  const reopenNow = () => {
    update((g, now) => reopenGame(g, now), 'Reopened game');
    setView('live');
  };

  return (
    <main class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-24">
      <h1 class="text-2xl font-bold">Final</h1>

      <p class="text-3xl font-bold" data-testid="final-score">
        {game.info.team || 'Us'} {d.usTotal} – {oppTotal(game)} {game.info.opponent}
      </p>

      <section class="space-y-3" aria-label="Export">
        {(['book', 'plays'] as const).map((kind) => (
          <div key={kind} class="space-y-1">
            <button
              type="button"
              class={`${btn} ${kind === 'book' ? 'bg-white text-slate-900' : 'bg-slate-600'}`}
              aria-describedby={`export-${kind}`}
              onClick={() => exportOne(kind)}
            >
              {EXPORT_NAME[kind]}
            </button>
            <p id={`export-${kind}`} class="text-sm text-slate-300">{EXPORT_DESCRIPTION[kind]}</p>
            <p
              class={`text-sm font-semibold ${game.exported?.[kind] ? 'text-emerald-300' : 'text-amber-300'}`}
              data-testid={`export-state-${kind}`}
            >
              {exportStateText(game, kind)}
            </p>
          </div>
        ))}
      </section>

      {periods.length > 0 && (
        <section aria-label="Open issues" class="space-y-3">
          <h2 class="text-lg font-bold">Not checked, or doesn't match the book</h2>
          {periods.map((p) => {
            const c = checkPeriod(game, p);
            return (
              <div key={p} class="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
                <div class="flex items-center justify-between">
                  <span class="font-bold">{periodLabel(p)} · {statusChipText(c.status)}</span>
                  <button type="button" class="min-h-11 px-3 font-semibold text-amber-300" onClick={() => reopen(p)}>
                    {issueAction(c.status)}
                  </button>
                </div>
                <input
                  class="min-h-12 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-base"
                  placeholder="Note"
                  aria-label={`Note for ${periodLabel(p)}`}
                  value={notes[p] ?? c.note}
                  onInput={(e) => setNotes({ ...notes, [p]: e.currentTarget.value })}
                  onBlur={() => saveNote(p)}
                />
              </div>
            );
          })}
        </section>
      )}

      {game.endedAt ? (
        <button type="button" class={`${btn} border border-slate-400`} onClick={reopenNow}>Reopen game</button>
      ) : (
        <button type="button" class={`${btn} border border-slate-400`} onClick={() => setConfirmEnd(true)}>End game early</button>
      )}

      <div class="grid grid-cols-2 gap-2">
        <button type="button" class={`${btn} border border-slate-500`} onClick={() => setView('live')}>Back to game</button>
        <button type="button" class={`${btn} border border-slate-500`} onClick={() => setView('setup')}>New game</button>
      </div>

      {confirmEnd && (
        <Sheet title="End the game now?" onClose={() => setConfirmEnd(false)}>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class={`${btn} bg-white text-slate-900`} onClick={endNow}>End game</button>
            <button type="button" class={`${btn} bg-slate-600`} onClick={() => setConfirmEnd(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
