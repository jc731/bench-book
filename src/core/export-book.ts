import { toCsv, type Cell } from './csv';
import { derive, oppPlaysRecorded, oppPointsRecorded, type TeamDerived } from './derive';
import { sideName } from './events';
import { periodLabel, spanLabel } from './periods';
import { checkPeriod } from './reconcile';
import type { Game, Player } from './types';

export function bookCsv(g: Game): string {
  const d = derive(g);
  const played = Array.from({ length: Math.max(4, g.currentPeriod) }, (_, i) => i + 1);
  const labels = played.map(periodLabel);
  const i = g.info;
  const rows: Cell[][] = [];

  rows.push(['Team', 'Opponent', 'Date', 'Home/Away', 'Coach', 'Scorer', 'Timekeeper']);
  rows.push([i.team, i.opponent, i.date, i.homeAway, i.coach, i.scorer, i.timer]);
  rows.push([]);

  // Running score after each period, as the paper book's Score by Qtr boxes hold it: the typed book
  // total where the scorer entered one, else the last typed total plus the app's points since, marked
  // `*`. Built from the last typed total, an estimate never runs backward past a book number.
  let usRun = 0;
  let usEstimated = false;
  const us: Cell[] = played.map((p) => {
    const c = checkPeriod(g, p);
    if (c.bookTotal !== null) { usRun = c.bookTotal; usEstimated = false; return usRun; }
    usRun += d.usByPeriod[p] ?? 0;
    usEstimated = true;
    return `${usRun}*`;
  });
  // Opponent the same way from taps; with taps off, an untyped period is blank, not a 0 nobody counted.
  const oppRecorded = oppPointsRecorded(g);
  let oppRun = 0;
  let oppEstimated = false;
  const opp: Cell[] = played.map((p) => {
    const c = checkPeriod(g, p);
    if (c.bookOppTotal !== null) { oppRun = c.bookOppTotal; oppEstimated = false; return oppRun; }
    if (!oppRecorded) { oppEstimated = true; return ''; }
    oppRun += d.oppByPeriod[p] ?? 0;
    oppEstimated = true;
    return `${oppRun}*`;
  });
  const oppFinal = !oppEstimated ? oppRun : oppRecorded ? `${oppRun}*` : '';
  rows.push(['Score by period (running score after each)']);
  rows.push(['', ...labels, 'Final']);
  rows.push([i.team, ...us, usEstimated ? `${usRun}*` : usRun]);
  rows.push([i.opponent, ...opp, oppFinal]);
  rows.push([]);

  pushTeamBlock(rows, played, labels, g.roster, d.us);
  if (oppPlaysRecorded(g)) {
    rows.push([`${i.opponent} (${sideName(g, 'them')})`]);
    pushTeamBlock(rows, played, labels, g.oppRoster, d.opp);
  }

  rows.push(['Reconcile']);
  // Book total / App total are the running scores; Book / App / Diff are the points over the compared
  // span, which is the period itself unless an earlier check was skipped (then `Compared` says Q2–Q3).
  rows.push(['Period', 'Book total', 'App total', 'Compared', 'Book', 'App', 'Diff', 'Status', 'Opp book total', 'Opp taps', 'Note']);
  for (const p of played) {
    const c = checkPeriod(g, p);
    rows.push([
      periodLabel(p), c.bookTotal ?? '', c.appTotal, spanLabel(c.spanFrom, p), c.bookSpan ?? '', c.appSpan,
      c.diff ?? '', c.status, c.bookOppTotal ?? '', c.oppTapped, c.note,
    ]);
  }
  return toCsv(rows, { guard: true });
}

// The player table, team fouls, bench technicals and timeouts for one team, then a blank row.
function pushTeamBlock(rows: Cell[][], played: number[], labels: string[], roster: Player[], t: TeamDerived): void {
  const byId = new Map(roster.map((p) => [p.id, p]));
  rows.push(['POS', 'PLAYER', 'NO.', 'FOULS', 'TECHS', ...labels, "2'S", "3'S", 'FTA', 'FTM', 'TP']);
  const tot = { fouls: 0, techs: 0, fg2: 0, fg3: 0, fta: 0, ftm: 0 };
  // The no-number line last, so the rows add up to TEAM TOTALS' TP and to team fouls less bench techs.
  const lines = t.noNumber ? [...t.players, t.noNumber] : t.players;
  for (const l of lines) {
    const p = l === t.noNumber ? null : byId.get(l.playerId)!;
    rows.push([
      p?.pos ?? '', p?.name ?? 'No number', p ? `#${p.number}` : '', l.fouls, l.techs,
      ...played.map((q) => (l.marksByPeriod[q] ?? []).join(' ')),
      l.fg2, l.fg3, l.fta, l.ftm, l.points,
    ]);
    tot.fouls += l.fouls; tot.techs += l.techs; tot.fg2 += l.fg2;
    tot.fg3 += l.fg3; tot.fta += l.fta; tot.ftm += l.ftm;
  }
  rows.push([
    'TEAM TOTALS', '', '', tot.fouls, tot.techs, ...played.map(() => ''),
    tot.fg2, tot.fg3, tot.fta, tot.ftm, t.total,
  ]);
  rows.push([]);

  for (const p of played) rows.push(['Team fouls', periodLabel(p), t.teamFoulsByPeriod[p] ?? 0]);
  rows.push(['Bench technicals', t.benchTechs]);
  const to = t.timeouts;
  rows.push(['Timeouts used', 'Full', `${to.full.used} of ${to.full.total}`]);
  rows.push(['Timeouts used', '30', `${to.thirty.used} of ${to.thirty.total}`]);
  rows.push(['Timeouts used', 'OT', `${to.ot.used} of ${to.ot.total}`]);
  rows.push([]);
}
