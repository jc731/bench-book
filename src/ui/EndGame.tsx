import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { exportFilename, playsCsv } from '../core/export-plays';
import { bookCsv } from '../core/export-book';
import { periodLabel } from '../core/periods';
import { checkPeriod, endGame, markExported, openIssues, oppTotal, saveReconcile } from '../core/reconcile';
import { download } from './download';
import { statusChipText } from './reconcile-logic';
import type { GameStore } from './store';

const btn = 'min-h-12 w-full rounded-xl px-4 text-lg font-bold';

export function EndGame({ store }: { store: GameStore }) {
  const { game, update, setView, openReconcile } = store;
  // Fixed on arrival so a row does not vanish under the scorer's thumb once it gets a note.
  const issuePeriods = useRef<number[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  if (!game) return null;
  if (issuePeriods.current === null) issuePeriods.current = openIssues(game).map((i) => i.period);
  const d = derive(game);

  const saveNote = (period: number) => {
    const c = checkPeriod(game, period);
    const text = notes[period] ?? c.note;
    if (text === c.note) return;
    update((g, now) => saveReconcile(g, period, c.bookUs, c.bookOpp, text, now), `Noted ${periodLabel(period)}`);
  };
  const reopen = (period: number) => openReconcile(period, 'end');
  const exportOne = (kind: 'book' | 'plays') => {
    download(exportFilename(game, kind), kind === 'book' ? bookCsv(game) : playsCsv(game));
    update((g, now) => markExported(g, now), 'Exported');
  };
  const finish = () => {
    if (!game.endedAt) update((g, now) => endGame(g, now), 'End game');
    setView('live');
  };

  return (
    <main class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-24">
      <div class="flex items-center gap-3">
        <button type="button" class="min-h-11 rounded-lg border border-slate-500 px-4 font-semibold" onClick={() => setView('live')}>
          Back
        </button>
        <h1 class="text-2xl font-bold">{game.endedAt ? 'Final' : 'End game / export'}</h1>
      </div>

      <p class="text-3xl font-bold" data-testid="final-score">
        {game.info.team || 'Us'} {d.usTotal} – {oppTotal(game)} {game.info.opponent}
      </p>

      {issuePeriods.current.length > 0 && (
        <section aria-label="Open issues" class="space-y-3">
          <h2 class="text-lg font-bold">Not checked, or doesn't match the book</h2>
          {issuePeriods.current.map((p) => {
            const c = checkPeriod(game, p);
            return (
              <div key={p} class="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
                <div class="flex items-center justify-between">
                  <span class="font-bold">{periodLabel(p)} · {statusChipText(c.status)}</span>
                  <button type="button" class="min-h-11 px-3 font-semibold text-amber-300" onClick={() => reopen(p)}>Reopen</button>
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
          <p class="text-sm text-slate-300">Anything still open is exported as it shows here: “not checked” as pending, “doesn't match” as unresolved.</p>
        </section>
      )}

      <section class="space-y-2" aria-label="Export">
        <button type="button" class={`${btn} bg-white text-slate-900`} onClick={() => exportOne('book')}>Book CSV</button>
        <button type="button" class={`${btn} bg-slate-600`} onClick={() => exportOne('plays')}>Plays CSV</button>
        <p class="text-sm text-slate-300">
          {game.exportedAt ? 'Exported.' : 'Not exported yet.'} The paper book stays official.
        </p>
      </section>

      <button type="button" class={`${btn} border border-slate-400`} onClick={finish}>
        {game.endedAt ? 'Done' : 'Finish game'}
      </button>
    </main>
  );
}
