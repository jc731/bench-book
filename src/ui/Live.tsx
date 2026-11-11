import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { appendEvent } from '../core/events';
import { periodLabel, isOvertime } from '../core/periods';
import { endGame, endPeriod, openIssues, oppTotal, startOvertime } from '../core/reconcile';
import type { EventDraft, Player, TimeoutKind } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { FeedbackLine } from './FeedbackLine';
import {
  BENCH_TECH_TEXT, endChoices, endPeriodLabel, feedbackLine, foulLabel, mayEndGame, oppLabel, playLabel, reconcileBanner,
  timeoutKindText, timeoutLabel, undoAriaLabel, type PlayType, type Toast,
} from './live-logic';
import { notExportedText } from './reconcile-logic';
import { PlayerGrid } from './PlayerGrid';
import { StatusStrip } from './StatusStrip';
import type { GameStore } from './store';

const bar = 'min-h-12 rounded-lg border border-slate-500 bg-slate-800 px-1 text-sm font-semibold active:bg-slate-700 disabled:opacity-40';
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';

type SheetKind = 'timeout' | 'endPeriod' | 'menu' | 'bench' | null;

export function Live({ store }: { store: GameStore }) {
  const { game, toast, update, undo, canUndo, setView, openReconcile } = store;
  const [picked, setPicked] = useState<Player | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  // The feedback present when a player's sheet opened: the sheet shows only what came after it.
  const sheetOpenedWith = useRef<Toast | null>(null);
  const pick = (p: Player) => {
    sheetOpenedWith.current = toast;
    setPicked(p);
  };

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
  const line = feedbackLine(banner, unexported, toast);

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <StatusStrip us={d.usTotal} opp={oppTotal(game)} period={period} derived={d} />
      <div data-testid="player-grid" class="min-h-0 flex-1 overflow-y-auto">
        <PlayerGrid roster={game.roster} lines={d.players} onPick={pick} onBench={() => setSheet('bench')} />
      </div>

      {/* The last entry, and a chip for the check prompt or else the not-exported warning. The bar's Undo is its Undo. */}
      <FeedbackLine
        line={line}
        class="shrink-0 border-t border-slate-600"
        onPrompt={(p) => (p.kind === 'check' ? openReconcile(p.period, 'live') : openEnd())}
        idleText={gameEnded ? 'Game ended. Entries are still accepted.' : undefined}
      />

      <nav class="space-y-2 border-t border-slate-700 bg-slate-950 p-2 pb-3">
        {game.trackOpponentTaps && (
          <div class="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" class={bar} onClick={() => add({ type: 'OPP_PTS', oppPoints: n }, oppLabel(n))}>
                Opp +{n}
              </button>
            ))}
          </div>
        )}
        <div class="grid grid-cols-5 gap-2">
          <button type="button" class={bar} onClick={() => setSheet('timeout')}>Timeout</button>
          <button
            type="button"
            class={bar}
            disabled={!canUndo}
            aria-label={undoAriaLabel(canUndo, game.events.length > 0)}
            aria-describedby={line.entry?.undoable ? 'feedback-text' : undefined}
            onClick={undo}
          >
            Undo
          </button>
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
        <EventSheet player={picked} toast={toast === sheetOpenedWith.current ? null : toast} onPlay={play} onUndo={undo} onClose={() => setPicked(null)} />
      )}
      {sheet === 'bench' && (
        <Sheet title="Bench" onClose={() => setSheet(null)}>
          <button
            type="button"
            class={`${opt} w-full`}
            onClick={() => {
              add({ type: 'BENCH_TECH' }, foulLabel('BENCH_TECH', { player: null, teamFouls }));
              setSheet(null);
            }}
          >
            {BENCH_TECH_TEXT}
          </button>
        </Sheet>
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
