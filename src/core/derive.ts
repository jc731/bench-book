import { orderedEvents } from './events';
import { otCount } from './periods';
import type { Game } from './types';

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

// Period maps only hold periods that had events; consumers treat a missing period as 0.
export interface Derived {
  usByPeriod: Record<number, number>;
  oppByPeriod: Record<number, number>; // OPP_PTS taps only
  usTotal: number;
  oppTotal: number;
  players: PlayerLine[]; // roster order
  teamFoulsByPeriod: Record<number, number>;
  teamFoulsForBonus(period: number): number; // period <= 4: that period; >= 5: Q4 + OT periods up to period
  oppInBonus(period: number): boolean; // teamFoulsForBonus >= 5
  benchTechs: number;
  timeouts: TimeoutState;
}

export const POINTS = { FG2: 2, FG3: 3, FTM: 1 } as const;
const MARK = { FG2: '2', FG3: '3', FTM: 'FT', FTX: '0' } as const;

function bump(map: Record<number, number>, key: number, by: number): void {
  map[key] = (map[key] ?? 0) + by;
}

export function derive(g: Game): Derived {
  const lines = new Map<string, PlayerLine>();
  for (const p of g.roster) {
    lines.set(p.id, {
      playerId: p.id, fg2: 0, fg3: 0, fta: 0, ftm: 0, points: 0, fouls: 0, techs: 0,
      pointsByPeriod: {}, marksByPeriod: {}, foulState: 'ok',
    });
  }
  const usByPeriod: Record<number, number> = {};
  const oppByPeriod: Record<number, number> = {};
  const teamFoulsByPeriod: Record<number, number> = {};
  let usTotal = 0;
  let oppTotal = 0;
  let benchTechs = 0;
  const used = { full: 0, thirty: 0, ot: 0 };

  for (const e of orderedEvents(g)) {
    const line = e.playerId ? lines.get(e.playerId) : undefined;
    switch (e.type) {
      case 'FG2':
      case 'FG3':
      case 'FTM':
      case 'FTX': {
        const pts = e.type === 'FTX' ? 0 : POINTS[e.type];
        usTotal += pts;
        bump(usByPeriod, e.period, pts);
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
      case 'OPP_PTS':
        oppTotal += e.oppPoints ?? 0;
        bump(oppByPeriod, e.period, e.oppPoints ?? 0);
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
    usByPeriod, oppByPeriod, usTotal, oppTotal,
    players: g.roster.map((p) => lines.get(p.id)!),
    teamFoulsByPeriod,
    teamFoulsForBonus,
    oppInBonus: (period) => teamFoulsForBonus(period) >= 5,
    benchTechs,
    timeouts: {
      full: { used: used.full, total: 3 },
      thirty: { used: used.thirty, total: 2 },
      ot: { used: used.ot, total: otCount(g.currentPeriod) },
    },
  };
}
