import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { appendEvent } from '../core/events';
import { periodLabel, isOvertime } from '../core/periods';
import { endGame, endPeriod, openIssues, oppTotal, startOvertime } from '../core/reconcile';
import type { EventDraft, Player, TimeoutKind } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { FeedbackLine } from './FeedbackLine';
import {
  BENCH_TECH_TEXT, endChoices, endPeriodLabel, endSlot, feedbackLine, foulLabel, oppLabel, playLabel, reconcileBanner,
  timeoutKindText, timeoutLabel, undoAriaLabel, type PlayType, type Toast,
} from './live-logic';
import { notExportedText } from './reconcile-logic';
import { PlayerGrid } from './PlayerGrid';
import { StatusStrip } from './StatusStrip';
import type { GameStore } from './store';

const barBase = 'min-h-12 rounded-lg bg-slate-800 px-1 text-sm font-semibold active:bg-slate-700 disabled:opacity-40';
const bar = `${barBase} border border-slate-500`;
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';
// The End slot's color says what it ends: amber a quarter, red the game (Q4 and OT). Final is plain.
const endTone = {
  quarter: 'border-2 border-amber-400 text-amber-300',
  game: 'border-2 border-red-500 text-red-300',
  final: 'border border-slate-500',
} as const;

type SheetKind = 'timeout' | 'endPeriod' | 'menu' | 'bench' | null;

export function Live({ store }: { store: GameStore }) {
  const { game, toast, update, undo, redo, canUndo, setView, openReconcile, openHowto } = store;
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
  // Only opens Final; the game ends from the Q4/OT sheet or Final's End game early.
  const openEnd = () => {
    setSheet(null);
    setView('end');
  };

  const timeoutKinds: TimeoutKind[] = isOvertime(period) ? ['full', 'thirty', 'ot'] : ['full', 'thirty'];
  const end = endSlot(period, Boolean(game.endedAt));
  const unexported = notExportedText(game, new Date());
  const line = feedbackLine(banner, unexported, toast);

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <StatusStrip us={d.usTotal} opp={oppTotal(game)} period={period} ended={Boolean(game.endedAt)} derived={d} />
      <div data-testid="player-grid" class="min-h-0 flex-1 overflow-y-auto">
        <PlayerGrid roster={game.roster} lines={d.players} onPick={pick} onBench={() => setSheet('bench')} />
      </div>

      {/* The last entry, and a chip for the check prompt or else the not-exported warning. The bar's Undo is its Undo. */}
      <FeedbackLine
        line={line}
        class="shrink-0 border-t border-slate-600"
        onPrompt={(p) => (p.kind === 'check' ? openReconcile(p.period, 'live') : openEnd())}
        onRedo={redo}
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
            class={`${barBase} ${endTone[end.tone]}`}
            data-tone={end.tone}
            onClick={() => (end.opens === 'final' ? openEnd() : end.opens === 'endSheet' ? setSheet('endPeriod') : doEndPeriod())}
          >
            {end.text}
            {end.mark && <span aria-hidden="true"> {end.mark}</span>}
          </button>
          <button type="button" class={bar} aria-label="More" onClick={() => setSheet('menu')}>⋯</button>
        </div>
      </nav>

      {picked && (
        <EventSheet player={picked} toast={toast === sheetOpenedWith.current ? null : toast} onPlay={play} onUndo={undo} onRedo={redo} onClose={() => setPicked(null)} />
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
            <button type="button" class={`${opt} border-2 border-amber-400`} onClick={startOt}>{endChoices(period).overtime}</button>
            <button type="button" class={`${opt} border-2 border-red-500 leading-tight`} onClick={doEndGame}>
              <span class="block">{endChoices(period).endGameMain}</span>{' '}
              <span class="block text-sm font-semibold">{endChoices(period).endGameNote}</span>
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'menu' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <button type="button" class={`${opt} w-full`} onClick={() => { setSheet(null); openHowto('live'); }}>How to use</button>
          <button type="button" class={`${opt} mt-2 w-full`} onClick={() => { setSheet(null); setView('running'); }}>Running score</button>
          <button type="button" class={`${opt} mt-2 w-full`} onClick={openEnd}>Final / export</button>
          <button type="button" class={`${opt} mt-2 w-full`} onClick={() => { setSheet(null); setView('setup'); }}>New game</button>
        </Sheet>
      )}
    </div>
  );
}
