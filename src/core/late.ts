import type { Game } from './types';

/** A play added after its quarter (D10, D11): an earlier period, or any period once the game has ended (D13). */
export function isLateAdd(g: Game, period: number): boolean {
  return !!g.endedAt || period < g.currentPeriod;
}
