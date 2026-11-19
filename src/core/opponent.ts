/** The opponent a game gets when none is typed: the game date as MM-DD (`2026-11-13` → `11-13`). */
export function defaultOpponent(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[1]}-${m[2]}` : 'Opponent';
}

export function opponentOrDefault(opponent: string, date: string): string {
  return opponent.trim() || defaultOpponent(date);
}
