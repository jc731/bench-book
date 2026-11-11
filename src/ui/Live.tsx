import { useEffect, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { appendEvent } from '../core/events';
import { periodLabel, isOvertime } from '../core/periods';
import { endGame, endPeriod, openIssues, oppTotal, startOvertime } from '../core/reconcile';
import type { EventDraft, Player, TimeoutKind } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import {
  BENCH_TECH_TEXT, endChoices, endPeriodLabel, foulLabel, mayEndGame, oppLabel, playLabel, reconcileBanner,
  timeoutKindText, timeoutLabel, undoAriaLabel, type PlayType,
} from './live-logic';
import { notExportedText } from './reconcile-logic';
import { PlayerGrid } from './PlayerGrid';
import { StatusStrip } from './StatusStrip';
import type { GameStore } from './store';

const TOAST_MS = 4000;
const bar = 'min-h-12 rounded-lg border border-slate-500 bg-slate-800 px-2 font-semibold active:bg-slate-700 disabled:opacity-40';
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';

type SheetKind = 'timeout' | 'endPeriod' | 'menu' | null;

export function Live({ store }: { store: GameStore }) {
  const { game, toast, clearToast, update, undo, canUndo, setView, openReconcile } = store;
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
  const teamFouls = d.teamFoulsForBonus(period);
  const play = (type: PlayType) => {
    if (!picked) return;
    const line = d.players.find((l) => l.playerId === picked.id);
    const label =
      type === 'FOUL' || type === 'TECH'
        ? foulLabel(type, { player: { p: picked, fouls: line?.fouls ?? 0, techs: line?.techs ?? 0 }, teamFouls })
        : playLabel(type, picked.number);
    add({ type, playerId: picked.id }, label);
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
    update((g, now) => (g.endedAt ? g : endGame(g, now)), 'End game');
    setSheet(null);
    setView('end');
  };
  const startOt = () => {
    update((g, now) => startOvertime(g, now), 'Start overtime');
    setSheet(null);
  };
  const openEnd = () => {
    setSheet(null);
    setView('end');
  };

  const timeoutKinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const gameEnded = Boolean(game.endedAt);
  const unexported = notExportedText(game, new Date());

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <StatusStrip us={d.usTotal} opp={oppTotal(game)} period={period} derived={d} />
      <div class="h-11 shrink-0">
        {banner ? (
          <button
            type="button"
            class="h-full w-full bg-amber-400 px-3 text-left text-sm font-semibold text-slate-900"
            onClick={() => openReconcile(banner.period, 'live')}
          >
            {banner.text}
          </button>
        ) : (
          unexported ? (
            <button type="button" class="h-full w-full bg-amber-400 px-3 text-left text-sm font-semibold text-slate-900" onClick={openEnd}>
              {unexported}
            </button>
          ) : (
            gameEnded && (
              <div class="flex h-full items-center bg-slate-700 px-3 text-sm font-semibold">
                Game ended. Entries are still accepted.
              </div>
            )
          )
        )}
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto pb-16">
        <PlayerGrid roster={game.roster} lines={d.players} onPick={setPicked} />
      </div>

      <div class="relative shrink-0">
      {toast && (
        <div class="absolute inset-x-0 bottom-full flex items-center justify-between gap-2 border-t border-slate-600 bg-slate-700 px-3 py-1" role="status">
          <span class="truncate font-semibold">{toast.text}</span>
          {toast.canUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      )}

      <nav class="space-y-2 border-t border-slate-700 bg-slate-950 p-2 pb-4">
        <div class="grid grid-cols-3 gap-2">
          <button type="button" class={bar} onClick={() => setSheet('timeout')}>Timeout</button>
          <button type="button" class={bar} onClick={() => add({ type: 'BENCH_TECH' }, foulLabel('BENCH_TECH', { player: null, teamFouls }))}>
            {BENCH_TECH_TEXT}
          </button>
          <button
            type="button"
            class={bar}
            disabled={!canUndo}
            aria-label={undoAriaLabel(canUndo, game.events.length > 0)}
            onClick={undo}
          >
            Undo
          </button>
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
      </div>

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
            <button type="button" class={opt} onClick={startOt}>{endChoices(period).overtime}</button>
            <button type="button" class={`${opt} leading-tight`} onClick={doEndGame}>
              <span class="block">{endChoices(period).endGameMain}</span>{' '}
              <span class="block text-sm font-semibold">{endChoices(period).endGameNote}</span>
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'menu' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <button type="button" class={`${opt} w-full`} onClick={() => { setSheet(null); setView('running'); }}>Running score</button>
          <button type="button" class={`${opt} mt-2 w-full`} onClick={openEnd}>End game / export</button>
          <button type="button" class={`${opt} mt-2 w-full`} onClick={() => { setSheet(null); setView('setup'); }}>New game</button>
        </Sheet>
      )}
    </div>
  );
}
