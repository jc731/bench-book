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

export interface GameEvent {
  id: string;
  order: number;
  period: number;
  type: EventType;
  playerId?: string;
  timeoutKind?: TimeoutKind;
  oppPoints?: 1 | 2 | 3;
  enteredAt: string; // ISO
  editedAt?: string;
}

export interface PeriodRecord {
  period: number;
  bookUs: number | null; // null = not entered yet (deferred)
  bookOpp: number | null;
  note: string;
  hadMismatch: boolean;
}

export interface Game {
  version: 1;
  id: string;
  info: GameInfo;
  roster: Player[];
  events: GameEvent[];
  currentPeriod: number;
  periods: PeriodRecord[];
  trackOpponentTaps: boolean; // default false
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
}

/** The check screen's fields as typed, plus the app's count when that check was first opened. */
export interface CheckDraft {
  us: string;
  opp: string;
  note: string;
  appAtOpen: number;
}

export type ExportKind = 'book' | 'plays';
export type ExportState = Partial<Record<ExportKind, string>>;

export type EventDraft = Omit<GameEvent, 'id' | 'order' | 'enteredAt' | 'editedAt' | 'period'> & {
  period?: number;
};
