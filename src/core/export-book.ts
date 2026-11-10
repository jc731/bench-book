import { toCsv, type Cell } from './csv';
import { derive } from './derive';
import { periodLabel } from './periods';
import { checkPeriod, oppTotal } from './reconcile';
import type { Game } from './types';

export function bookCsv(g: Game): string {
  const d = derive(g);
  const played = Array.from({ length: Math.max(4, g.currentPeriod) }, (_, i) => i + 1);
  const labels = played.map(periodLabel);
  const i = g.info;
  const rows: Cell[][] = [];

  rows.push(['Team', 'Opponent', 'Date', 'Home/Away', 'Coach', 'Scorer', 'Timer']);
  rows.push([i.team, i.opponent, i.date, i.homeAway, i.coach, i.scorer, i.timer]);
  rows.push([]);

  // Us: the book's number where the scorer entered one, else our own sum marked `*`.
  let usSum = 0;
  let estimated = false;
  const us: Cell[] = played.map((p) => {
    const c = checkPeriod(g, p);
    if (c.bookUs !== null) { usSum += c.bookUs; return c.bookUs; }
    usSum += c.appUs;
    estimated = true;
    return `${c.appUs}*`;
  });
  const opp: Cell[] = played.map((p) => {
    const c = checkPeriod(g, p);
    return c.bookOpp ?? c.oppTapped;
  });
  rows.push(['Score by period']);
  rows.push(['', ...labels, 'Total']);
  rows.push([i.team, ...us, estimated ? `${usSum}*` : usSum]);
  rows.push([i.opponent, ...opp, oppTotal(g)]);
  rows.push([]);

  const byId = new Map(g.roster.map((p) => [p.id, p]));
  rows.push(['POS', 'PLAYER', 'NO.', 'FOULS', 'TECHS', ...labels, "2'S", "3'S", 'FTA', 'FTM', 'TP']);
  const tot = { fouls: 0, techs: 0, fg2: 0, fg3: 0, fta: 0, ftm: 0 };
  for (const l of d.players) {
    const p = byId.get(l.playerId)!;
    rows.push([
      p.pos, p.name, `#${p.number}`, l.fouls, l.techs,
      ...played.map((q) => (l.marksByPeriod[q] ?? []).join(' ')),
      l.fg2, l.fg3, l.fta, l.ftm, l.points,
    ]);
    tot.fouls += l.fouls; tot.techs += l.techs; tot.fg2 += l.fg2;
    tot.fg3 += l.fg3; tot.fta += l.fta; tot.ftm += l.ftm;
  }
  rows.push([
    'TEAM TOTALS', '', '', tot.fouls, tot.techs, ...played.map(() => ''),
    tot.fg2, tot.fg3, tot.fta, tot.ftm, d.usTotal,
  ]);
  rows.push([]);

  for (const p of played) rows.push(['Team fouls', periodLabel(p), d.teamFoulsByPeriod[p] ?? 0]);
  rows.push(['Bench technicals', d.benchTechs]);
  const t = d.timeouts;
  rows.push(['Timeouts used', 'Full', `${t.full.used} of ${t.full.total}`]);
  rows.push(['Timeouts used', '30', `${t.thirty.used} of ${t.thirty.total}`]);
  rows.push(['Timeouts used', 'OT', `${t.ot.used} of ${t.ot.total}`]);
  rows.push([]);

  rows.push(['Reconcile']);
  rows.push(['Period', 'Book', 'App', 'Diff', 'Status', 'Opp book', 'Opp taps', 'Note']);
  for (const p of played) {
    const c = checkPeriod(g, p);
    rows.push([
      periodLabel(p), c.bookUs ?? '', c.appUs, c.diff ?? '', c.status, c.bookOpp ?? '',
      c.oppTapped, c.note,
    ]);
  }
  return toCsv(rows);
}
