import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { appendEvent, homeSide, rosterOf, sideName } from '../core/events';
import { periodLabel } from '../core/periods';
import { endGame, endPeriod, openIssues, oppTotal, startOvertime } from '../core/reconcile';
import type { EventDraft, Player, Side, TimeoutKind } from '../core/types';
import { EventSheet, Sheet } from './EventSheet';
import { FeedbackLine } from './FeedbackLine';
import {
  BENCH_TECH_TEXT, BONUS_AT, endChoices, endPeriodLabel, endSlot, feedbackLine, foulLabel, playLabel, who, reconcileBanner,
  outReason, timeoutLabel, undoAriaLabel, type PlayType, type Toast,
} from './live-logic';
import { notExportedText } from './reconcile-logic';
import { StatusStrip } from './StatusStrip';
import { TeamHalf } from './TeamHalf';
import type { GameStore } from './store';

const barBase = 'min-h-12 rounded-lg bg-slate-800 px-1 text-sm font-semibold active:bg-slate-700 disabled:opacity-40';
const bar = `${barBase} border border-slate-500`;
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';
// The End slot's color says what it ends: blue (the action color) a quarter, red the game (Q4 and OT). Final is plain.
const endTone = {
  quarter: 'border-2 border-sky-400 text-sky-300',
  game: 'border-2 border-red-500 text-red-300',
  final: 'border border-slate-500',
} as const;

type SheetKind = 'endPeriod' | 'menu' | 'bench' | null;
/** Whose play sheet is open: a player's card (`p`), or a team's + Play card (`p` null, no number). */
type Picked = { side: Side; p: Player | null };

export function Live({ store }: { store: GameStore }) {
  const { game, toast, update, undo, redo, canUndo, setView, openReconcile, openHowto } = store;
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  // The Bench sheet's team.
  const [benchSide, setBenchSide] = useState<Side>('us');
  // The feedback present when a play sheet opened: the sheet shows only what came after it.
  const sheetOpenedWith = useRef<Toast | null>(null);
  const pick = (side: Side, p: Player | null) => {
    sheetOpenedWith.current = toast;
    setPicked({ side, p });
  };

  if (!game) return null;
  const d = derive(game);
  const period = game.currentPeriod;
  const banner = reconcileBanner(openIssues(game));

  const add = (draft: EventDraft, label: string) => update((g, now) => appendEvent(g, draft, now), label);
  const teamOf = (side: Side) => (side === 'us' ? d.us : d.opp);
  // Absent means ours, so only their events carry a side.
  const sided = (side: Side): Pick<EventDraft, 'side'> => (side === 'them' ? { side: 'them' } : {});
  const lineOf = (pk: Picked) => (pk.p ? teamOf(pk.side).players.find((l) => l.playerId === pk.p!.id) : undefined);
  const play = (type: PlayType) => {
    if (!picked) return;
    const { side, p } = picked;
    const tag = sideName(game, side);
    const teamFouls = teamOf(side).teamFoulsForBonus(period);
    const line = lineOf(picked);
    let label: string;
    if (type !== 'FOUL' && type !== 'TECH') label = playLabel(type, who(p, tag));
    else if (p) label = foulLabel(type, { player: { p, fouls: line?.fouls ?? 0, techs: line?.techs ?? 0 }, teamFouls, tag });
    else {
      // A foul with no number: the team's, toward its bonus like any other.
      const base = playLabel(type, who(null, tag));
      label = teamFouls + 1 === BONUS_AT ? `${base} — bonus` : base;
    }
    // + Play records the team's play with no number. Task 8 puts the Whose number? prompt here,
    // before the play is added, for a team that has not chosen Stop asking.
    add({ type, ...(p ? { playerId: p.id } : {}), ...sided(side) }, label);
    if (type !== 'FTM' && type !== 'FTX') setPicked(null);
  };
  // One tap takes the timeout, at zero too (the count shown never drops below 0). Task 8 guards zero.
  const timeout = (side: Side, kind: TimeoutKind) =>
    add({ type: 'TIMEOUT', timeoutKind: kind, ...sided(side) }, timeoutLabel(kind, sideName(game, side)));
  const openBench = (side: Side) => {
    setBenchSide(side);
    setSheet('bench');
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

  const end = endSlot(period, Boolean(game.endedAt));
  const unexported = notExportedText(game, new Date());
  const line = feedbackLine(banner, unexported, toast);
  // Home always left and light, Away right and dark; only the US tag changes between home and away nights.
  const home = homeSide(game);
  const away: Side = home === 'us' ? 'them' : 'us';
  const total = (side: Side) => (side === 'us' ? d.usTotal : oppTotal(game));
  // A team shoots when the other team is in the bonus: our fouls put them there, theirs put us there.
  const shoots = (side: Side) => (side === 'us' ? d.usInBonus(period) : d.oppInBonus(period));
  const benchTeam = teamOf(benchSide);

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <StatusStrip
        home={total(home)}
        away={total(away)}
        period={period}
        ended={Boolean(game.endedAt)}
        shooters={{ home: shoots(home), away: shoots(away) }}
      />
      <div class="grid min-h-0 flex-1 grid-cols-2">
        {[home, away].map((side) => (
          <TeamHalf
            key={side}
            side={sideName(game, side)}
            tone={side === home ? 'light' : 'dark'}
            isUs={side === 'us'}
            roster={rosterOf(game, side)}
            team={teamOf(side)}
            period={period}
            onPick={(p) => pick(side, p)}
            onTeamPlay={() => pick(side, null)}
            onBench={() => openBench(side)}
            onTimeout={(k) => timeout(side, k)}
          />
        ))}
      </div>

      {/* The last entry, and a chip for the check prompt or else the not-exported warning. The bar's Undo is its Undo. */}
      <FeedbackLine
        line={line}
        class="shrink-0 border-t border-slate-600"
        onPrompt={(p) => (p.kind === 'check' ? openReconcile(p.period, 'live') : openEnd())}
        onRedo={redo}
      />

      <nav class="space-y-2 border-t border-slate-700 bg-slate-950 p-2 pb-3">
        <div class="grid grid-cols-4 gap-2">
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
            class={`${barBase} whitespace-nowrap ${endTone[end.tone]}`}
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
        <EventSheet
          player={picked.p}
          title={picked.p ? undefined : sideName(game, picked.side)}
          out={outReason(lineOf(picked))}
          toast={toast === sheetOpenedWith.current ? null : toast}
          onPlay={play}
          onUndo={undo}
          onRedo={redo}
          onClose={() => setPicked(null)}
        />
      )}
      {sheet === 'bench' && (
        <Sheet title={`${sideName(game, benchSide)} bench`} onClose={() => setSheet(null)}>
          <p class="mb-2 text-sm text-slate-300" data-testid="bench-sheet-count">
            Bench techs this game: {benchTeam.benchTechs}
          </p>
          <button
            type="button"
            class={`${opt} w-full`}
            onClick={() => {
              const tag = sideName(game, benchSide);
              add({ type: 'BENCH_TECH', ...sided(benchSide) }, foulLabel('BENCH_TECH', { player: null, teamFouls: benchTeam.teamFoulsForBonus(period), tag }));
              setSheet(null);
            }}
          >
            {BENCH_TECH_TEXT}
          </button>
        </Sheet>
      )}
      {sheet === 'endPeriod' && (
        <Sheet title={`End ${periodLabel(period)}`} onClose={() => setSheet(null)}>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class={`${opt} border-2 border-sky-400`} onClick={startOt}>{endChoices(period).overtime}</button>
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
