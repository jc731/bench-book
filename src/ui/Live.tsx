import { useRef, useState } from 'preact/hooks';
import { derive } from '../core/derive';
import { addPlayer, appendEvent, homeSide, recordSub, rosterOf, sideName } from '../core/events';
import { periodLabel } from '../core/periods';
import { lineup } from '../core/lineup';
import { endGame, endPeriod, openIssues, oppTotal, startOvertime } from '../core/reconcile';
import type { EventDraft, Player, Side, TimeoutKind } from '../core/types';
import { EventSheet, Sheet, WhoseNumberSheet } from './EventSheet';
import { SubSheet } from './SubSheet';
import { subRowText, type SubStart } from './sub-logic';
import { FeedbackLine } from './FeedbackLine';
import {
  BENCH_TECH_TEXT, TAKE_ANYWAY, namedWho, endChoices, endPeriodLabel, endSlot, feedbackLine, foulLabel, playLabel, playToast, who, reconcileBanner,
  outReason, subLabel, timeoutLabel, timeoutsLeft, undoAriaLabel, zeroTimeoutWarning, type PlayType, type Toast,
} from './live-logic';
import { validateRoster } from './roster';
import { notExportedText } from './reconcile-logic';
import { StatusStrip } from './StatusStrip';
import { TeamHalf } from './TeamHalf';
import { demoActive, resetDemo } from './demo';
import { getStorage, type GameStore } from './store';

const barBase = 'min-h-12 rounded-lg bg-slate-800 px-1 text-sm font-semibold active:bg-slate-700 disabled:opacity-40';
const bar = `${barBase} border border-slate-500`;
const opt = 'min-h-14 rounded-xl bg-slate-600 text-xl font-bold active:bg-slate-500';
// The End slot's color says what it ends: blue (the action color) a quarter, red the game (Q4 and OT). Final is plain.
const endTone = {
  quarter: 'border-2 border-sky-400 text-sky-300',
  game: 'border-2 border-red-500 text-red-300',
  final: 'border border-slate-500',
} as const;

type SheetKind = 'endPeriod' | 'menu' | 'bench' | 'timeoutGuard' | null;
/**
 * Whose play sheet is open: a player's card (`p`), or a team's + Play card (`p` null, no number).
 * `pair` is set after a free throw answered No number, so the second shot records without asking
 * again; the sheet closing (or any other play, which closes it) ends the pair.
 */
type Picked = { side: Side; p: Player | null; pair?: boolean };
const isFt = (t: PlayType) => t === 'FTM' || t === 'FTX';

export function Live({ store }: { store: GameStore }) {
  const { game, toast, update, undo, redo, canUndo, setView, openReconcile, openHowto } = store;
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  // The Bench sheet's team.
  const [benchSide, setBenchSide] = useState<Side>('us');
  // The + Play's play waiting at Whose number?, while that prompt is open.
  const [asking, setAsking] = useState<PlayType | null>(null);
  // The sub sheet's team and the player a play sheet's sub row already moved, while it is open.
  const [subbing, setSubbing] = useState<{ side: Side; start: SubStart } | null>(null);
  // The timeout tapped at zero, while its guard sheet is open.
  const [guard, setGuard] = useState<{ side: Side; kind: TimeoutKind } | null>(null);
  // The feedback present when a play sheet opened: the sheet shows only what came after it.
  const sheetOpenedWith = useRef<Toast | null>(null);
  const pick = (side: Side, p: Player | null) => {
    sheetOpenedWith.current = toast;
    setAsking(null);
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
  /** Records one play; a new player joins the roster and Stop asking is set in the same entry, so one Undo takes it all back. The toast is worded from the game the play is applied to. */
  const record = (side: Side, p: Player | null, type: PlayType, opts: { newPlayer?: boolean; stopAsking?: boolean } = {}) =>
    update((g, now) => {
      let h = opts.newPlayer && p ? addPlayer(g, side, p, now) : g;
      if (opts.stopAsking) h = { ...h, noNumbers: { ...h.noNumbers, [side]: true } };
      const next = appendEvent(h, { type, ...(p ? { playerId: p.id } : {}), ...sided(side) }, now);
      return { game: next, label: playToast(g, next, side, p, type) };
    }, '');
  const play = (type: PlayType) => {
    if (!picked) return;
    const { side, p } = picked;
    // A team's + Play asks whose number, unless the scorer chose Stop asking for that team.
    if (!p && !game.noNumbers?.[side] && !(picked.pair && isFt(type))) {
      setAsking(type);
      return;
    }
    record(side, p, type);
    if (!isFt(type)) setPicked(null);
  };
  /** No number / Stop asking: the team's play. A free throw goes back to the team's sheet for the pair. */
  const recordNoNumber = (stopAsking: boolean) => {
    if (!picked || !asking) return;
    record(picked.side, null, asking, { stopAsking });
    setPicked(isFt(asking) ? { ...picked, pair: true } : null);
    setAsking(null);
  };
  /** A number typed at Whose number?: credits that player, adding them to the team first if new. */
  const saveNumber = (number: string): string | null => {
    if (!picked || !asking) return null;
    const { side } = picked;
    const roster = rosterOf(game, side);
    const known = roster.find((q) => q.number.trim() === number);
    if (known && outReason(lineOf({ side, p: known }))) {
      // An out player: their own sheet, with its warning, before anything is recorded.
      setAsking(null);
      setPicked({ side, p: known });
      return null;
    }
    const p = known ?? { id: crypto.randomUUID(), number, name: '', pos: '' };
    if (!known) {
      const error = validateRoster([...roster, p])[0];
      if (error) return error;
    }
    record(side, p, asking, { newPlayer: !known });
    // A free throw goes on to that player's sheet for the second shot.
    setPicked(isFt(asking) ? { side, p } : null);
    setAsking(null);
    return null;
  };
  /**
   * One Sub per completed sub sheet; its toast is worded from the game the sub is applied to. A forgotten
   * sub (6 on, one taken off) stores only the out, but its toast names the player who came in by playing:
   * the label only, so a Log fix to her play still takes her off the floor.
   */
  const recordSubs = (side: Side, ins: string[], outs: string[]) => {
    update((g, now) => {
      const l = lineup(g, side);
      const shown = ins.length === 0 && outs.length === 1 && l.floor.length === 6 && l.justIn && l.justIn !== outs[0] ? [l.justIn] : ins;
      return { game: recordSub(g, side, ins, outs, now), label: subLabel(g, side, shown, outs) };
    }, '');
    setSubbing(null);
  };
  /** The play sheet's sub row, for a tracked team's player who is not out. */
  const subRowFor = (pk: Picked) => {
    if (!pk.p) return null;
    const l = lineup(game, pk.side);
    const text = l.tracked ? subRowText(l, pk.p.id, pk.p.number) : null;
    if (!text) return null;
    const id = pk.p.id;
    const start: SubStart = l.floor.includes(id) ? { out: id } : { in: id };
    return { text, onSub: () => { setPicked(null); setSubbing({ side: pk.side, start }); } };
  };
  const takeTimeout = (side: Side, kind: TimeoutKind) =>
    add({ type: 'TIMEOUT', timeoutKind: kind, ...sided(side) }, timeoutLabel(kind, sideName(game, side)));
  // A timeout with none left asks first; the count shown never drops below 0.
  const timeout = (side: Side, kind: TimeoutKind) => {
    if (timeoutsLeft(teamOf(side).timeouts, kind) > 0) return takeTimeout(side, kind);
    setGuard({ side, kind });
    setSheet('timeoutGuard');
  };
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
            lineup={lineup(game, side)}
            period={period}
            onPick={(p) => pick(side, p)}
            onTeamPlay={() => pick(side, null)}
            onBench={() => openBench(side)}
            onSub={() => setSubbing({ side, start: null })}
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

      {picked && asking && (
        <WhoseNumberSheet
          play={playLabel(asking, sideName(game, picked.side))}
          onSave={saveNumber}
          onNoNumber={() => recordNoNumber(false)}
          onStopAsking={() => recordNoNumber(true)}
          onClose={() => {
            setAsking(null);
            setPicked(null);
          }}
        />
      )}
      {picked && !asking && (
        <EventSheet
          player={picked.p}
          // Titled with the team, as the toasts are: `#14 Name (Away)`, or `Away` for + Play.
          title={namedWho(picked.p, sideName(game, picked.side))}
          out={outReason(lineOf(picked))}
          toast={toast === sheetOpenedWith.current ? null : toast}
          onPlay={play}
          onUndo={undo}
          onRedo={redo}
          onClose={() => setPicked(null)}
          subRow={subRowFor(picked)}
          reserveSubRow
        />
      )}
      {subbing && (
        <SubSheet
          game={game}
          side={subbing.side}
          start={subbing.start}
          onRecord={(ins, outs) => recordSubs(subbing.side, ins, outs)}
          onClose={() => setSubbing(null)}
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
      {sheet === 'timeoutGuard' && guard && (
        <Sheet title={timeoutLabel(guard.kind, sideName(game, guard.side))} onClose={() => setSheet(null)}>
          <p class="mb-3 font-semibold text-amber-300" role="alert">{zeroTimeoutWarning(sideName(game, guard.side), guard.kind)}</p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="min-h-12 rounded-xl border border-slate-400 font-semibold" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              type="button"
              class="min-h-12 rounded-xl border-2 border-amber-400 font-semibold text-amber-300"
              onClick={() => {
                takeTimeout(guard.side, guard.kind);
                setSheet(null);
              }}
            >
              {TAKE_ANYWAY}
            </button>
          </div>
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
          {demoActive() && (
            <button
              type="button"
              class={`${opt} mt-2 w-full`}
              onClick={() => { setSheet(null); resetDemo(getStorage().storage); store.discard(); }}
            >
              Reset demo
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
