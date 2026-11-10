import { useEffect, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { appendEvent } from '../core/events';
import { exportFilename, playsCsv } from '../core/export-plays';
import { periodLabel, isOvertime } from '../core/periods';
import { endGame, endPeriod, openIssues, oppTotal } from '../core/reconcile';
import type { EventDraft, Player, TimeoutKind } from '../core/types';
import { download } from './download';
import { EventSheet, Sheet } from './EventSheet';
import {
  endPeriodLabel, mayEndGame, oppLabel, playLabel, reconcileBanner, timeoutKindText, timeoutLabel,
  type PlayType,
} from './live-logic';
import { PlayerGrid } from './PlayerGrid';
import { StatusStrip } from './StatusStrip';
import type { GameStore } from './store';

const TOAST_MS = 4000;
const bar = 'min-h-12 rounded-lg border border-slate-500 bg-slate-800 px-2 font-semibold active:bg-slate-700 disabled:opacity-40';
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';

type SheetKind = 'timeout' | 'endPeriod' | 'menu' | null;

export function Live({ store }: { store: GameStore }) {
  const { game, toast, clearToast, update, undo, canUndo, setView, setReconcilePeriod } = store;
  const [picked, setPicked] = useState<Player | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!game) return null;
  const d = derive(game);
  const period = game.currentPeriod;
  const banner = reconcileBanner(openIssues(game));

  const add = (draft: EventDraft, label: string) => update((g, now) => appendEvent(g, draft, now), label);
  const play = (type: PlayType) => {
    if (!picked) return;
    add({ type, playerId: picked.id }, playLabel(type, picked.number));
    if (type !== 'FTM' && type !== 'FTX') setPicked(null);
  };
  const timeout = (kind: TimeoutKind) => {
    add({ type: 'TIMEOUT', timeoutKind: kind }, timeoutLabel(kind));
    setSheet(null);
  };
  const doEndPeriod = () => {
    update((g, now) => endPeriod(g, now), endPeriodLabel(period));
    setSheet(null);
  };
  const doEndGame = () => {
    update((g, now) => endGame(g, now), 'End game');
    setSheet(null);
  };
  const openReconcile = (p: number) => {
    setReconcilePeriod(p);
    setView('reconcile');
  };
  const exportCsv = () => {
    download(exportFilename(game, 'plays'), playsCsv(game));
    setSheet(null);
  };

  const timeoutKinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const gameEnded = Boolean(game.endedAt);

  return (
    <div class="flex h-dvh flex-col">
      <StatusStrip us={d.usTotal} opp={oppTotal(game)} period={period} derived={d} />
      {banner && (
        <button
          type="button"
          class="min-h-11 shrink-0 bg-amber-400 px-3 text-left text-sm font-semibold text-slate-900"
          onClick={() => openReconcile(banner.period)}
        >
          {banner.text}
        </button>
      )}
      {gameEnded && (
        <div class="shrink-0 bg-slate-700 px-3 py-2 text-sm font-semibold">
          Game ended. Entries are still accepted; export from ⋯.
        </div>
      )}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <PlayerGrid roster={game.roster} lines={d.players} onPick={setPicked} />
      </div>

      {toast && (
        <div class="flex shrink-0 items-center justify-between gap-2 border-t border-slate-600 bg-slate-700 px-3 py-1" role="status">
          <span class="truncate font-semibold">{toast.text}</span>
          {toast.canUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      )}

      <nav class="shrink-0 space-y-2 border-t border-slate-700 bg-slate-950 p-2 pb-4">
        <div class="grid grid-cols-3 gap-2">
          <button type="button" class={bar} onClick={() => setSheet('timeout')}>Timeout</button>
          <button type="button" class={bar} onClick={() => add({ type: 'BENCH_TECH' }, 'Bench T')}>Bench T</button>
          <button type="button" class={bar} disabled={!canUndo} onClick={undo}>Undo</button>
        </div>
        {game.trackOpponentTaps && (
          <div class="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" class={bar} onClick={() => add({ type: 'OPP_PTS', oppPoints: n }, oppLabel(n))}>
                Opp +{n}
              </button>
            ))}
          </div>
        )}
        <div class="grid grid-cols-3 gap-2">
          <button type="button" class={bar} onClick={() => setView('log')}>Log</button>
          <button
            type="button"
            class={bar}
            onClick={() => (mayEndGame(period) ? setSheet('endPeriod') : doEndPeriod())}
          >
            {endPeriodLabel(period)}{mayEndGame(period) ? '…' : ''}
          </button>
          <button type="button" class={bar} aria-label="More" onClick={() => setSheet('menu')}>⋯</button>
        </div>
      </nav>

      {picked && (
        <EventSheet player={picked} toast={toast} onPlay={play} onUndo={undo} onClose={() => setPicked(null)} />
      )}
      {sheet === 'timeout' && (
        <Sheet title="Timeout" onClose={() => setSheet(null)}>
          <div class={`grid gap-2 ${timeoutKinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {timeoutKinds.map((k) => (
              <button key={k} type="button" class={opt} onClick={() => timeout(k)}>
                {timeoutKindText(k)}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'endPeriod' && (
        <Sheet title={`End ${periodLabel(period)}`} onClose={() => setSheet(null)}>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class={opt} onClick={doEndPeriod}>Start OT</button>
            <button type="button" class={opt} onClick={doEndGame}>End game</button>
          </div>
        </Sheet>
      )}
      {sheet === 'menu' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <button type="button" class={`${opt} w-full`} onClick={exportCsv}>Export plays CSV</button>
        </Sheet>
      )}
    </div>
  );
}
