import { derive, type PlayerLine, type TeamDerived } from '../core/derive';
import { appendEvent, homeSide, orderedEvents, rosterOf, sideName, sideOf } from '../core/events';
import { isLateAdd } from '../core/late';
import { periodLabel } from '../core/periods';
import { checkPeriod, oppTotal } from '../core/reconcile';
import type { Game, GameEvent, Player, Side } from '../core/types';
import { BONUS_AT, foulOutLabel, namedWho, who, type PlayType } from './live-logic';
import { addedLabel } from './log-logic';

/** One quarter cell. `empty`: no play at all that period (D6), so a missed free throw alone is a 0, not a blank. */
export interface StatsCell { points: number; fouls: number; empty: boolean }

export interface StatsRow {
  /** The player id, or 'none' for No number. */
  key: string;
  /** null for No number. */
  player: Player | null;
  /** One per column of `StatsGrid.periods`. */
  cells: StatsCell[];
  points: number;
  fouls: number;
  techs: number;
  foulState: 'ok' | 'warn' | 'out';
}

export interface StatsGrid {
  side: Side;
  /** 1..max(4, currentPeriod): every OT up to the current one shows, even with no plays (D3). */
  periods: number[];
  /** Roster order, then No number when that team has a no-number play (D4). */
  rows: StatsRow[];
  /** The Team row: points and team fouls (bench techs included) per period, and the totals. */
  team: { points: number[]; fouls: number[]; total: number; totalFouls: number };
  /**
   * The Score row: the recorded running score after each period, as the book's Score by Qtr (D4). Its last
   * entry is the strip's score unless a saved check typed an opponent total that differs from their
   * recorded points; the strip then shows the book's total and this row what was recorded (I3, amended).
   */
  score: { home: number[]; away: number[] };
}

export const NO_NUMBER_KEY = 'none';

/** Whether a play belongs on a team's No number row: as `derive` credits it (no player, or one not on the roster). */
function isNoNumberPlay(e: GameEvent, side: Side, onRoster: Set<string>): boolean {
  if (e.type === 'OPP_PTS') return side === 'them';
  if (sideOf(e) !== side || e.type === 'BENCH_TECH' || e.type === 'TIMEOUT') return false;
  return !e.playerId || !onRoster.has(e.playerId);
}

/** The plays in one cell, oldest first (D9). `playerId` null is the No number row. */
export function cellPlays(g: Game, side: Side, playerId: string | null, period: number): GameEvent[] {
  const onRoster = new Set(rosterOf(g, side).map((p) => p.id));
  return orderedEvents(g).filter((e) =>
    e.period === period
    && (playerId === null
      ? isNoNumberPlay(e, side, onRoster)
      : e.type !== 'OPP_PTS' && sideOf(e) === side && e.playerId === playerId));
}

function teamOf(g: Game, side: Side): TeamDerived {
  const d = derive(g);
  return side === 'us' ? d.us : d.opp;
}

function periodsOf(g: Game): number[] {
  return Array.from({ length: Math.max(4, g.currentPeriod) }, (_, i) => i + 1);
}

function running(by: Record<number, number>, periods: number[]): number[] {
  let t = 0;
  return periods.map((p) => (t += by[p] ?? 0));
}

export function statsGrid(g: Game, side: Side): StatsGrid {
  const d = derive(g);
  const team = side === 'us' ? d.us : d.opp;
  const periods = periodsOf(g);
  const row = (key: string, player: Player | null, line: PlayerLine): StatsRow => ({
    key, player,
    cells: periods.map((p) => ({
      points: line.pointsByPeriod[p] ?? 0,
      fouls: line.foulsByPeriod[p] ?? 0,
      empty: cellPlays(g, side, player ? player.id : null, p).length === 0,
    })),
    points: line.points, fouls: line.fouls, techs: line.techs,
    // The No number line never fouls out: it is several players.
    foulState: player ? line.foulState : 'ok',
  });
  const roster = rosterOf(g, side);
  const rows = roster.map((p, i) => row(p.id, p, team.players[i]));
  if (team.noNumber) rows.push(row(NO_NUMBER_KEY, null, team.noNumber));
  const h = homeSide(g);
  const byHome = h === 'us' ? d.us.byPeriod : d.opp.byPeriod;
  const byAway = h === 'us' ? d.opp.byPeriod : d.us.byPeriod;
  return {
    side, periods, rows,
    team: {
      points: periods.map((p) => team.byPeriod[p] ?? 0),
      fouls: periods.map((p) => team.teamFoulsByPeriod[p] ?? 0),
      total: team.total,
      totalFouls: Object.values(team.teamFoulsByPeriod).reduce((a, b) => a + b, 0),
    },
    score: { home: running(byHome, periods), away: running(byAway, periods) },
  };
}

/** The Home | Away toggle's order: Home first (D2). */
export function sideOrder(g: Game): Side[] {
  const h = homeSide(g);
  return [h, h === 'us' ? 'them' : 'us'];
}

/**
 * Whether a quarter cell takes adds (Task 4 opens the cell sheet from it): any quarter that has
 * started, and every quarter of an ended game (D13). A quarter not yet reached is drawn, faint, and
 * not tappable (controller ruling 2026-11-19). The footer rows and totals are never tappable (D9).
 */
export function cellTappable(g: Game, period: number): boolean {
  return Boolean(g.endedAt) || period <= g.currentPeriod;
}

/** A Home | Away toggle's text (D2): the team name, else its tag, then the strip's score for it. */
export function toggleText(g: Game, side: Side): string {
  const name = (side === 'us' ? g.info.team : g.info.opponent).trim() || sideName(g, side);
  const score = side === 'us' ? derive(g).usTotal : oppTotal(g);
  return `${name} ${score}`;
}

/** The total cell (D7): points, `F n` (amber at 4 by `foulState`), `OUT` when out, and `T n` with any tech. */
export function totalText(r: StatsRow): { points: string; fouls: string; tech: string | null } {
  return {
    points: String(r.points),
    fouls: r.foulState === 'out' ? 'OUT' : `F ${r.fouls}`,
    tech: r.techs > 0 ? `T ${r.techs}` : null,
  };
}

/** The cell sheet's title (D9): `#5 Casey Moreno (Home) · Q2`, or `No number (Home) · Q2`. */
export function cellTitle(g: Game, side: Side, player: Player | null, period: number): string {
  const tag = sideName(g, side);
  const name = player ? namedWho(player, tag) : `No number (${tag})`;
  return `${name} · ${periodLabel(period)}`;
}

/** Records a play from a cell at the end of `period` (D10); a late one never promotes (D11). */
export function addToCell(g: Game, side: Side, playerId: string | null, type: PlayType, period: number, now: Date): Game {
  return appendEvent(g, {
    type,
    period,
    ...(playerId ? { playerId } : {}),
    ...(side === 'them' ? { side: 'them' as const } : {}),
    ...(isLateAdd(g, period) ? { late: true as const } : {}),
  }, now);
}

/** The first period at or after `period` with a typed book total for this side: its check's span covers `period`. */
function coveringCheck(g: Game, side: Side, period: number): number | null {
  const key = side === 'us' ? 'bookUsTotal' : 'bookOppTotal';
  let best: number | null = null;
  for (const r of g.periods) {
    if (r[key] !== null && r.period >= period && (best === null || r.period < best)) best = r.period;
  }
  return best;
}

/** Book minus app over that check's span for this side; null with no typed total. */
function checkOff(g: Game, side: Side, period: number): number | null {
  const c = checkPeriod(g, period);
  if (side === 'us') return c.diff;
  return c.bookOppSpan === null ? null : c.bookOppSpan - c.oppTapped;
}

/**
 * The feedback line for a play added from a cell (D12), from the game before and after the add:
 * - the add puts the player out → the live out text (`#5 Casey Moreno (Home) out, 5 fouls. Tell the official.`), red;
 * - else `Added #5 (Home) Foul to Q2`, plus ` — bonus` when it puts the other team in the bonus for the current
 *   period, plus ` · Q3 check now 2 over` when the saved check covering that quarter matched and no longer does
 *   (amber).
 */
export function addFeedback(
  before: Game, after: Game, side: Side, player: Player | null, type: PlayType, period: number,
): { text: string; tone: 'plain' | 'amber' | 'red' } {
  const tag = sideName(before, side);
  const teamBefore = teamOf(before, side);
  const teamAfter = teamOf(after, side);
  const cur = before.currentPeriod;
  const bonus = teamBefore.teamFoulsForBonus(cur) < BONUS_AT && teamAfter.teamFoulsForBonus(cur) >= BONUS_AT;

  if (player) {
    const was = teamBefore.players.find((l) => l.playerId === player.id);
    const now = teamAfter.players.find((l) => l.playerId === player.id);
    // The same reason foulToast gives: 5 fouls first, else the 2nd tech.
    const reason = !now || (was?.foulState === 'out') ? null
      : now.fouls >= 5 && (was?.fouls ?? 0) < 5 ? '5 fouls'
        : now.techs >= 2 && (was?.techs ?? 0) < 2 ? '2 techs' : null;
    if (reason) return { text: foulOutLabel(namedWho(player, tag), reason, bonus), tone: 'red' };
  }

  let text = addedLabel(type, who(player, tag), period);
  if (bonus) text += ' — bonus';
  const checked = coveringCheck(before, side, period);
  if (checked !== null && checkOff(before, side, checked) === 0) {
    const off = checkOff(after, side, checked);
    if (off !== null && off !== 0) {
      return { text: `${text} · ${periodLabel(checked)} check now ${Math.abs(off)} ${off > 0 ? 'short' : 'over'}`, tone: 'amber' };
    }
  }
  return { text, tone: 'plain' };
}
