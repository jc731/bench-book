export type EventType =
  | 'FG2' | 'FG3' | 'FTM' | 'FTX' // made 2, made 3, FT made, FT missed (player required)
  | 'FOUL' | 'TECH' // personal / technical (player required)
  | 'BENCH_TECH' // bench/coach technical (no player)
  | 'TIMEOUT' // timeoutKind required
  | 'OPP_PTS'; // opponent live tap, oppPoints required

export type TimeoutKind = 'full' | 'thirty' | 'ot';

export interface Player {
  id: string;
  number: string;
  name: string;
  pos: string;
}

export interface GameInfo {
  team: string;
  opponent: string;
  date: string; // YYYY-MM-DD
  homeAway: 'home' | 'away';
  coach: string;
  scorer: string;
  timer: string;
}

export type Side = 'us' | 'them';

export interface GameEvent {
  id: string;
  order: number;
  period: number;
  type: EventType;
  playerId?: string;
  timeoutKind?: TimeoutKind;
  oppPoints?: 1 | 2 | 3;
  /** Absent means ours; 'them' marks the opponent's play. */
  side?: 'them';
  enteredAt: string; // ISO
  editedAt?: string;
}

export interface PeriodRecord {
  period: number;
  /**
   * The game score at the end of this period as the scorer typed it from the book's running total
   * (not the points scored in the period). null = not entered yet (deferred).
   */
  bookUsTotal: number | null;
  bookOppTotal: number | null;
  note: string;
  hadMismatch: boolean;
}

export interface Game {
  version: 1;
  id: string;
  info: GameInfo;
  roster: Player[];
  /** The opponent's players (may be empty); migrated to [] for older saves. */
  oppRoster: Player[];
  events: GameEvent[];
  currentPeriod: number;
  periods: PeriodRecord[];
  trackOpponentTaps: boolean; // legacy: kept for old saves, no longer drives anything
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  /**
   * When each CSV was last downloaded; the game counts as exported only when both were. Every edit
   * after an export drops this (see `applyUpdate`), so a mark always means the file matches the game.
   */
  exported?: ExportState;
  /**
   * What the scorer typed on a quarter check and left with Later, by period. Not a check: nothing
   * reads it but the check screen, and it is never exported. Absent in games saved before drafts.
   */
  checkDrafts?: Record<number, CheckDraft>;
  /**
   * Teams whose scorer chose "Stop asking this game": their + Play records team plays with no
   * Whose number? prompt. Absent (or a side absent) means ask; games saved before it have none.
   */
  noNumbers?: Partial<Record<Side, boolean>>;
  /**
   * Deliberate substitutions, both teams, anchored among the plays by `order`. Not plays: never in the
   * CSVs, the Log or any count. Absent in games saved before 0.9; readers treat absent as [].
   */
  subs?: Sub[];
}

/**
 * One substitution for one team: who went in and who came out. Replayed against the derived floor, so an
 * in already on the floor or an out already off it is skipped (see `lineup`).
 */
export interface Sub {
  id: string;
  side: Side;
  ins: string[];
  outs: string[];
  /** Same scale as `GameEvent.order`; on a tie with a play, the sub comes first. */
  order: number;
  period: number;
  enteredAt: string; // ISO
}

/**
 * The check screen's fields as typed (game totals), plus the app's points over the checked span when
 * that check was first opened.
 */
export interface CheckDraft {
  us: string;
  opp: string;
  note: string;
  appSpanAtOpen: number;
}

export type ExportKind = 'book' | 'plays';
export type ExportState = Partial<Record<ExportKind, string>>;

export type EventDraft = Omit<GameEvent, 'id' | 'order' | 'enteredAt' | 'editedAt' | 'period'> & {
  period?: number;
};
