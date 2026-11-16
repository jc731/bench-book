import { orderedEvents, rosterOf, sideOf } from './events';
import { otCount } from './periods';
import type { Game, Side } from './types';

export interface PlayerLine {
  playerId: string;
  fg2: number;
  fg3: number;
  fta: number;
  ftm: number;
  points: number;
  fouls: number; // FOUL + TECH
  techs: number;
  pointsByPeriod: Record<number, number>;
  marksByPeriod: Record<number, string[]>; // '2', '3', 'FT', '0' in event order
  foulState: 'ok' | 'warn' | 'out'; // warn at 4 fouls; out at >= 5 fouls or >= 2 techs
}

export interface TimeoutState {
  full: { used: number; total: 3 };
  thirty: { used: number; total: 2 };
  ot: { used: number; total: number };
}

export interface TeamDerived {
  players: PlayerLine[]; // roster order
  byPeriod: Record<number, number>;
  total: number;
  teamFoulsByPeriod: Record<number, number>;
  teamFoulsForBonus(period: number): number; // period <= 4: that period; >= 5: Q4 + OT periods up to period
  benchTechs: number;
  timeouts: TimeoutState;
}

// Period maps only hold periods that had events; consumers treat a missing period as 0.
// Top-level team fields mean OUR team only; `opp` is the other team.
export interface Derived {
  us: TeamDerived;
  opp: TeamDerived;
  usByPeriod: Record<number, number>;
  oppByPeriod: Record<number, number>; // alias of opp.byPeriod (their plays + legacy OPP_PTS)
  usTotal: number;
  oppTotal: number; // alias of opp.total
  players: PlayerLine[];
  teamFoulsByPeriod: Record<number, number>;
  teamFoulsForBonus(period: number): number;
  oppInBonus(period: number): boolean; // our fouls >= 5
  usInBonus(period: number): boolean; // their fouls >= 5
  benchTechs: number;
  timeouts: TimeoutState;
}

export const POINTS = { FG2: 2, FG3: 3, FTM: 1 } as const;
const MARK = { FG2: '2', FG3: '3', FTM: 'FT', FTX: '0' } as const;

function bump(map: Record<number, number>, key: number, by: number): void {
  map[key] = (map[key] ?? 0) + by;
}

function deriveTeam(g: Game, side: Side): TeamDerived {
  const lines = new Map<string, PlayerLine>();
  const roster = rosterOf(g, side);
  for (const p of roster) {
    lines.set(p.id, {
      playerId: p.id, fg2: 0, fg3: 0, fta: 0, ftm: 0, points: 0, fouls: 0, techs: 0,
      pointsByPeriod: {}, marksByPeriod: {}, foulState: 'ok',
    });
  }
  const byPeriod: Record<number, number> = {};
  const teamFoulsByPeriod: Record<number, number> = {};
  let total = 0;
  let benchTechs = 0;
  const used = { full: 0, thirty: 0, ot: 0 };

  for (const e of orderedEvents(g)) {
    if (e.type === 'OPP_PTS') {
      // Legacy team-level points: never a side, always theirs.
      if (side === 'them') {
        total += e.oppPoints ?? 0;
        bump(byPeriod, e.period, e.oppPoints ?? 0);
      }
      continue;
    }
    if (sideOf(e) !== side) continue;
    const line = e.playerId ? lines.get(e.playerId) : undefined;
    switch (e.type) {
      case 'FG2':
      case 'FG3':
      case 'FTM':
      case 'FTX': {
        const pts = e.type === 'FTX' ? 0 : POINTS[e.type];
        total += pts;
        bump(byPeriod, e.period, pts);
        if (!line) break;
        if (e.type === 'FG2') line.fg2++;
        if (e.type === 'FG3') line.fg3++;
        if (e.type === 'FTM') line.ftm++;
        if (e.type === 'FTM' || e.type === 'FTX') line.fta++;
        line.points += pts;
        bump(line.pointsByPeriod, e.period, pts);
        (line.marksByPeriod[e.period] ??= []).push(MARK[e.type]);
        break;
      }
      case 'FOUL':
      case 'TECH':
        bump(teamFoulsByPeriod, e.period, 1);
        if (line) {
          line.fouls++;
          if (e.type === 'TECH') line.techs++;
        }
        break;
      case 'BENCH_TECH':
        bump(teamFoulsByPeriod, e.period, 1);
        benchTechs++;
        break;
      case 'TIMEOUT':
        if (e.timeoutKind) used[e.timeoutKind]++;
        break;
    }
  }

  for (const line of lines.values()) {
    line.foulState = line.fouls >= 5 || line.techs >= 2 ? 'out' : line.fouls >= 4 ? 'warn' : 'ok';
  }

  const teamFoulsForBonus = (period: number): number => {
    if (period <= 4) return teamFoulsByPeriod[period] ?? 0;
    let sum = teamFoulsByPeriod[4] ?? 0;
    for (let p = 5; p <= period; p++) sum += teamFoulsByPeriod[p] ?? 0;
    return sum;
  };

  return {
    players: roster.map((p) => lines.get(p.id)!),
    byPeriod, total, teamFoulsByPeriod, teamFoulsForBonus, benchTechs,
    timeouts: {
      full: { used: used.full, total: 3 },
      thirty: { used: used.thirty, total: 2 },
      ot: { used: used.ot, total: otCount(g.currentPeriod) },
    },
  };
}

export function derive(g: Game): Derived {
  const us = deriveTeam(g, 'us');
  const opp = deriveTeam(g, 'them');
  return {
    us, opp,
    usByPeriod: us.byPeriod, oppByPeriod: opp.byPeriod,
    usTotal: us.total, oppTotal: opp.total,
    players: us.players,
    teamFoulsByPeriod: us.teamFoulsByPeriod,
    teamFoulsForBonus: us.teamFoulsForBonus,
    oppInBonus: (period) => us.teamFoulsForBonus(period) >= 5,
    usInBonus: (period) => opp.teamFoulsForBonus(period) >= 5,
    benchTechs: us.benchTechs,
    timeouts: us.timeouts,
  };
}
