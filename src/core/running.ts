import { orderedEvents } from './events';
import type { Game } from './types';

export interface Mark {
  score: number;
  mark: '/' | 'X' | '●';
  number: string;
  period: number;
  endsPeriod: boolean;
}

const SCORING = {
  FG2: { pts: 2, mark: 'X' },
  FTM: { pts: 1, mark: '/' },
  FG3: { pts: 3, mark: '●' },
} as const;

// Our scoring events in order, as the running-score column of the book shows them.
// FTX scores nothing and gets no mark.
export function runningScore(g: Game): Mark[] {
  const numberOf = new Map(g.roster.map((p) => [p.id, p.number]));
  const marks: Mark[] = [];
  let score = 0;
  for (const e of orderedEvents(g)) {
    if (e.type !== 'FG2' && e.type !== 'FG3' && e.type !== 'FTM') continue;
    const s = SCORING[e.type];
    score += s.pts;
    marks.push({
      score, mark: s.mark, number: (e.playerId && numberOf.get(e.playerId)) || '',
      period: e.period, endsPeriod: false,
    });
  }
  const lastOf = new Map<number, Mark>();
  for (const m of marks) lastOf.set(m.period, m);
  for (const m of lastOf.values()) m.endsPeriod = true;
  return marks;
}

