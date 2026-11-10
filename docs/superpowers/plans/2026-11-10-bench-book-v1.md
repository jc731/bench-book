# Bench Book v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, offline-capable, mobile-first web app that keeps one team's basketball scorebook alongside a paper Murray book, reconciles each period against it, and exports two CSVs.

**Architecture:** All game logic is pure TypeScript in `src/core/`. A `Game` holds an **event log**, and every number on screen and in both exports is *derived* from that log by pure functions. Nothing is stored twice. The UI is a single Astro page hosting one Preact island (`client:only`), with a small store that saves the `Game` to `localStorage` after every change. A service worker makes it work offline.

**Tech Stack:** Astro 7, Preact (`@astrojs/preact`), Tailwind CSS 4 (`@tailwindcss/vite`), TypeScript, Vitest, Playwright, `@vite-pwa/astro`, pnpm, Netlify (static).

**Spec:** `docs/superpowers/specs/2026-11-10-bench-book-v1-design.md`, which the executor must read first.

## Global Constraints

- Static output only. No server code, no adapter, no API routes.
- **No network calls carrying game data. No analytics, no third-party scripts or fonts.** The roster is personal data about minors.
- No roster data (names/numbers) in the repo, fixtures included: tests use invented names (`Player One`), never real ones.
- Rules: IESA/NFHS. Team fouls reset each quarter, the bonus flag shows from our **5th** team foul in a quarter, OT continues the Q4 count, **every technical (player or bench) is a team foul**, player warning at **4** fouls, and out at **5** fouls **or 2 technicals** (NFHS disqualification; entries are still accepted).
- Timeouts: Full ×**3**, 30-sec ×**2**, +**1** OT timeout per OT period. Unused timeouts carry over. Using a timeout is never blocked.
- Game data is purged **72 hours** after `updatedAt`. The saved roster never expires.
- The app never blocks an entry on a rule. **Ending a period is one tap that advances immediately** (with an Undo toast); reconciling happens on a non-blocking card the scorer opens when there's time, and can be deferred indefinitely.
- Every entry shows a short toast naming what was recorded, with **Undo**. Undo reverses the last *action* of any kind (add, edit, delete, end period, reconcile save), via a snapshot stack in the store.
- The service worker must never reload the page on its own: updates apply only from the Setup screen or when no game is in progress.
- Tap targets ≥ **44 px**. Usable one-thumb in portrait on a phone.
- US English in all copy, comments and commit messages. Commits carry no Claude/Anthropic attribution trailer.
- `pnpm check` (= `astro check && tsc --noEmit && vitest run`) is the per-commit gate.

## Review Focus

1. **Jersey `0` vs `00`**: these are different players. They must stay distinct everywhere, and must survive being opened in Excel, which strips leading zeros (Task 5 test `book CSV keeps 00 distinct from 0`).
2. **Editing a past period after it was reconciled**: the period's status must re-derive. Moving from matched to mismatched shows the problem again, and nothing stale is kept (Task 4 test `status re-derives after a later edit`).
3. **An event inserted or edited into a past period** counts toward *that* period's team fouls and score, not the current period's (Task 3 test `foul inserted into Q1 counts in Q1`).
4. **Names with commas, quotes or newlines** in either CSV (Task 5 test `escapes commas, quotes and newlines`).
5. **Missed "End Q1"**: Q2 events land in Q1. The Log's "Move this and everything after to…" fixes it in one action (Task 9; core test `moveFrom shifts later events` in Task 2).
6. **`localStorage` unavailable or full** (Safari private mode, quota): the app keeps working in memory and shows a "not saving" warning, and never crashes (Task 6 test `save reports failure instead of throwing`).

---

## File Structure

```
astro.config.mjs            Astro + Preact + Tailwind + PWA
netlify.toml                build = pnpm build, publish = dist
src/pages/index.astro       shell page, mounts <App client:only="preact" />
src/styles/global.css       @import "tailwindcss"
src/core/types.ts           Game, GameEvent, Player, GameInfo, PeriodRecord
src/core/periods.ts         period labels, OT helpers
src/core/events.ts          append / insertBefore / edit / delete / undo
src/core/derive.ts          scores, player lines, team fouls, timeouts
src/core/running.ts         running-score marks
src/core/reconcile.ts       period status, endPeriod, endGame
src/core/csv.ts             cell escaping, rows → string
src/core/export-book.ts     book-layout CSV
src/core/export-plays.ts    play-by-play CSV
src/core/storage.ts         load/save game + roster, 72 h purge
src/ui/store.ts             useGameStore() hook, autosave
src/ui/App.tsx              view switch: setup | live | log | running | reconcile | end
src/ui/Setup.tsx  Live.tsx  StatusStrip.tsx  PlayerGrid.tsx  EventSheet.tsx
src/ui/Log.tsx  Reconcile.tsx  RunningScore.tsx  EndGame.tsx
src/ui/download.ts          Blob download helper
e2e/game.spec.ts            scripted-game smoke test
```

Core tests are co-located: `src/core/*.test.ts`. **`src/core` imports no framework code** (no Preact, no Astro) — it is the hedge that keeps v2/v3/stats framework-agnostic. A future print page (v3) is its own Astro page with its own small island and `@media print`, not a view inside the app.

---

### Task 1: Scaffold

**Files:** Create `package.json`, `astro.config.mjs`, `tsconfig.json`, `netlify.toml`, `vitest.config.ts`, `src/pages/index.astro`, `src/styles/global.css`, `src/ui/App.tsx`, `src/core/smoke.test.ts`, `.gitignore`

**Interfaces:** Produces the scripts `dev`, `build`, `preview`, `test` (`vitest run`), `test:e2e` (`playwright test`), `check`.

- [ ] **Step 1:** In the existing repo root (README/LICENSE/docs already exist; don't overwrite them), add the dependencies: `astro`, `@astrojs/preact`, `preact`, `tailwindcss`, `@tailwindcss/vite`, and dev deps `typescript`, `@astrojs/check`, `vitest`, `@playwright/test`. Use the current major versions (Astro 7, Tailwind 4).
- [ ] **Step 2:** `astro.config.mjs`: `output: 'static'`, `integrations: [preact()]`, `vite.plugins: [tailwindcss()]`. `index.astro` renders `<App client:only="preact" />` and sets the viewport meta, `theme-color`, and the title "Bench Book". `App.tsx` renders the heading "Bench Book".
- [ ] **Step 3:** `netlify.toml`: `[build] command = "pnpm build"`, `publish = "dist"`.
- [ ] **Step 4:** `src/core/smoke.test.ts`: `expect(1 + 1).toBe(2)`. This only proves the runner works, and Task 2 deletes it.
- [ ] **Step 5:** Run `pnpm check && pnpm build`. Expected: both exit 0, and `dist/index.html` exists.
- [ ] **Step 6:** Commit: `chore: scaffold Astro + Preact + Tailwind app`

---

### Task 2: Core types and the event log

**Files:** Create `src/core/types.ts`, `src/core/periods.ts`, `src/core/events.ts`, `src/core/events.test.ts`. Delete `src/core/smoke.test.ts`.

**Interfaces — Produces:**

```ts
// types.ts
export type EventType =
  | 'FG2' | 'FG3' | 'FTM' | 'FTX'      // made 2, made 3, FT made, FT missed (player required)
  | 'FOUL' | 'TECH'                    // personal / technical (player required)
  | 'BENCH_TECH'                       // bench/coach technical (no player)
  | 'TIMEOUT'                          // timeoutKind required
  | 'OPP_PTS';                         // opponent live tap, oppPoints required
export type TimeoutKind = 'full' | 'thirty' | 'ot';
export interface Player { id: string; number: string; name: string; pos: string }
export interface GameInfo { team: string; opponent: string; date: string /* YYYY-MM-DD */;
  homeAway: 'home' | 'away'; coach: string; scorer: string; timer: string }
export interface GameEvent { id: string; order: number; period: number; type: EventType;
  playerId?: string; timeoutKind?: TimeoutKind; oppPoints?: 1 | 2 | 3;
  enteredAt: string /* ISO */; editedAt?: string }
export interface PeriodRecord { period: number; bookUs: number | null; bookOpp: number | null;
  note: string; hadMismatch: boolean }   // null = not entered yet (deferred)
export interface Game { version: 1; id: string; info: GameInfo; roster: Player[];
  events: GameEvent[]; currentPeriod: number; periods: PeriodRecord[]; trackOpponentTaps: boolean /* default false */;
  createdAt: string; updatedAt: string; endedAt?: string; exportedAt?: string }
export type EventDraft = Omit<GameEvent, 'id' | 'order' | 'enteredAt' | 'editedAt' | 'period'> & { period?: number };

// periods.ts — period 1..4 = Q1..Q4, 5 = OT1, 6 = OT2, ...
export function periodLabel(p: number): string;   // 1→'Q1', 5→'OT1'
export function isOvertime(p: number): boolean;   // p > 4
export function otCount(p: number): number;       // max(0, p - 4)

// events.ts — all pure; return a new Game with updatedAt = now
export function newGame(info: GameInfo, roster: Player[], now: Date): Game;   // currentPeriod 1
export function appendEvent(g: Game, d: EventDraft, now: Date): Game;          // period defaults to currentPeriod; order = max+1
export function insertEventBefore(g: Game, beforeId: string, d: EventDraft, now: Date): Game; // period = target's period
export function editEvent(g: Game, id: string, patch: Partial<Pick<GameEvent,'type'|'playerId'|'period'|'timeoutKind'|'oppPoints'>>, now: Date): Game; // sets editedAt
export function deleteEvent(g: Game, id: string, now: Date): Game;
export function moveFrom(g: Game, fromId: string, period: number, now: Date): Game; // sets period on fromId and every event after it (by order) whose period is >= fromId's original period
export function orderedEvents(g: Game): GameEvent[];      // sorted by order
```

Ids come from `crypto.randomUUID()`. `insertEventBefore` sets `order` to the midpoint between the target and its predecessor, or `target.order - 1` when the target is first.

- [ ] **Step 1: Write the failing tests** in `events.test.ts`:
  - `periodLabel`: `[1,4,5,6].map(periodLabel)` equals `['Q1','Q4','OT1','OT2']`.
  - `appendEvent` stamps `currentPeriod`, and orders appended events 0,1,2 in sequence.
  - `insertEventBefore(g, e2.id, draft)` places the new event between e1 and e2 in `orderedEvents`, with `period === e2.period`, even when `currentPeriod` has moved on.
  - Inserting before the first event places the new one first.
  - `moveFrom shifts later events`: with events A(Q1) B(Q1) C(Q1), `moveFrom(g, B.id, 2)` leaves A in Q1 and puts B and C in Q2.
  - `editEvent` changes the type and sets `editedAt`; `deleteEvent` removes the event; every op bumps `updatedAt` and does not mutate its input (check with `Object.freeze` on the input).
- [ ] **Step 2:** Run `pnpm vitest run src/core/events.test.ts`. Expected: FAIL, because the modules don't exist yet.
- [ ] **Step 3:** Implement `types.ts`, `periods.ts` and `events.ts` with the signatures above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): game model and editable event log`

---

### Task 3: Derived game state

**Files:** Create `src/core/derive.ts`, `src/core/derive.test.ts`

**Interfaces:** Consumes Task 2. Produces:

```ts
export interface PlayerLine { playerId: string; fg2: number; fg3: number; fta: number; ftm: number;
  points: number; fouls: number /* FOUL + TECH */; techs: number;
  pointsByPeriod: Record<number, number>; marksByPeriod: Record<number, string[]> /* '2','3','FT','0' in order */;
  foulState: 'ok' | 'warn' | 'out' }               // warn at 4 fouls; out at >= 5 fouls OR >= 2 techs
export interface TimeoutState { full: { used: number; total: 3 }; thirty: { used: number; total: 2 };
  ot: { used: number; total: number /* otCount(currentPeriod) */ } }
export interface Derived { usByPeriod: Record<number, number>; oppByPeriod: Record<number, number> /* from OPP_PTS */;
  usTotal: number; oppTotal: number; players: PlayerLine[] /* roster order */;
  teamFoulsByPeriod: Record<number, number>;        // raw count per period
  teamFoulsForBonus(period: number): number;        // period<=4: that period; >=5: Q4 + all OT up to period
  oppInBonus(period: number): boolean;              // teamFoulsForBonus >= 5
  benchTechs: number; timeouts: TimeoutState }
export function derive(g: Game): Derived;
```

Team fouls = `FOUL + TECH + BENCH_TECH` events. Opponent totals here come from `OPP_PTS` taps only; Task 4 decides which value is the record.

- [ ] **Step 1: Write the failing tests**, building games with `appendEvent`:
  - Points: FG2+FG3+FTM = 6, FTX adds 0 but counts as an FTA; `marksByPeriod[1]` = `['2','3','FT','0']`.
  - `foul inserted into Q1 counts in Q1`: with 2 fouls in Q2, insert a FOUL before a Q1 event, and `teamFoulsByPeriod` = `{1:1, 2:2}`.
  - Reset: 4 fouls in Q1, then 1 in Q2, gives `oppInBonus(2) === false`.
  - OT carry: 3 fouls in Q4 and 2 in OT1 give `teamFoulsForBonus(5) === 5` and `oppInBonus(5) === true`; Q3's fouls don't carry.
  - Technicals: one TECH (player) plus one BENCH_TECH gives 2 team fouls, and the player has `fouls 1, techs 1`.
  - Player foulState: 3 → `ok`, 4 → `warn`, 5 → `out`, 6 → still `out`; 2 TECH and nothing else → `out`. Adding a FG2 after 5 fouls is accepted and counted.
  - Timeouts: with `currentPeriod 6`, `ot.total === 2`. Using 4 `full` timeouts gives `used 4` with nothing blocked or thrown.
  - Third OT: `currentPeriod 7` gives `ot.total 3`, and `usByPeriod[7]` exists once an event is in it.
- [ ] **Step 2:** Run `pnpm vitest run src/core/derive.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `derive(g)` in a single pass over `orderedEvents(g)`.
- [ ] **Step 4:** Run it again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): derive scores, fouls, bonus and timeouts`

---

### Task 4: Running score, reconcile and period flow

**Files:** Create `src/core/running.ts`, `src/core/reconcile.ts`, and their `.test.ts` files.

**Interfaces:** Consumes Tasks 2–3. Produces:

```ts
// running.ts
export interface Mark { score: number; mark: '/' | 'X' | '●'; number: string; period: number; endsPeriod: boolean }
export function runningScore(g: Game): Mark[];   // our scoring events in order; FTX excluded; endsPeriod on each period's last mark

// reconcile.ts
export type PeriodStatus = 'pending' | 'matched' | 'fixed' | 'noted' | 'unresolved';
export interface PeriodCheck { period: number; appUs: number; bookUs: number | null; diff: number | null /* bookUs - appUs */;
  bookOpp: number | null; oppTapped: number; status: PeriodStatus; note: string }
export function checkPeriod(g: Game, period: number): PeriodCheck;
//   no record, or bookUs === null → note.trim() ? 'noted' : 'pending';
//   appUs === bookUs → hadMismatch ? 'fixed' : 'matched'; else note.trim() ? 'noted' : 'unresolved'
export function endPeriod(g: Game, now: Date): Game;   // currentPeriod += 1 and nothing else; one tap at the table
export function saveReconcile(g: Game, period: number, bookUs: number | null, bookOpp: number | null, note: string, now: Date): Game;
//   upserts the PeriodRecord; hadMismatch becomes true (and stays true) when bookUs !== null && bookUs !== appUs
export function endGame(g: Game, now: Date): Game;   // sets endedAt; does NOT advance currentPeriod
export function openIssues(g: Game): PeriodCheck[];   // ended periods (period < currentPeriod, or all if endedAt) whose status is 'unresolved' or 'pending'
export function oppTotal(g: Game): number;            // sum of bookOpp over records, + taps in periods without a record
```

- [ ] **Step 1: Write the failing tests:**
  - `runningScore`: FG2(#4), FTM(#00), FG3(#4) give scores 2, 3, 6 with marks `X`, `/`, `●`, numbers `'4','00','4'`. FTX produces no mark. The last mark of Q1 has `endsPeriod: true`.
  - `checkPeriod`: an app score of 10 against a book score of 12 gives `diff 2` and `unresolved`; the same with a note gives `noted`.
  - `status re-derives after a later edit`: end Q1 matched at 10, then (now in Q2) insert a FG2 into Q1, and `checkPeriod(g,1).status` becomes `unresolved`; delete it again and the status is `fixed`.
  - Deferring: `endPeriod` with no reconcile gives Q1 `pending` (bookUs `null`, diff `null`, never a false "10 over"), and `openIssues` lists it.
  - `saveReconcile(g,1,null,null,'book lost')` gives `noted`.
  - `oppTotal` prefers `bookOpp` over the taps for reconciled periods.
- [ ] **Step 2:** Run `pnpm vitest run src/core/running.test.ts src/core/reconcile.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement both modules with the signatures above.
- [ ] **Step 4:** Run them again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): running score and per-period reconcile`

---

### Task 5: CSV exports

**Files:** Create `src/core/csv.ts`, `src/core/export-book.ts`, `src/core/export-plays.ts`, and their tests.

**Interfaces:** Consumes Tasks 2–4. Produces:

```ts
export function toCsv(rows: (string | number)[][]): string;   // RFC 4180, \r\n line ends, UTF-8 BOM prefix
export function bookCsv(g: Game): string;
export function playsCsv(g: Game): string;
export function exportFilename(g: Game, kind: 'book' | 'plays'): string;
//   `bench-book_${date}_${slug(opponent)}_${kind}.csv`; slug = lowercase, non-alphanumerics → '-', trimmed
```

The **book CSV** is made of blocks separated by one empty row, in this order:
1. `Team,Opponent,Date,Home/Away,Coach,Scorer,Timer`, then the values.
2. A `Score by period` row; a header `,Q1,Q2,Q3,Q4,[OT1..],Total`; then a row for us (book scores; app sums, marked `*`, for periods with no book number) and a row for the opponent (`oppTotal` logic).
3. Players: `POS,PLAYER,NO.,FOULS,TECHS,Q1..Q4,[OT…],2'S,3'S,FTA,FTM,TP`. Each period cell holds the marks joined by spaces (e.g. `2 2 FT 0`). **NO. is written as `#4` / `#00`**, so spreadsheets keep the leading zeros. The section ends with a `TEAM TOTALS` row.
4. `Team fouls`, one row per period; `Bench technicals`; `Timeouts used` as Full/30/OT used out of total.
5. `Reconcile`: `Period,Book,App,Diff,Status,Opp book,Opp taps,Note`, one row per period played. When `Opp taps` disagrees with `Opp book`, that is the difference the spec says gets noted. Taps are never adjusted.

The **plays CSV** is a single table: `seq,period,team,number,player,event,points,us_score,opp_score,entered_at,edited`. The team is `us` or `opp`, the event is the `EventType`, the number is raw (no `#`), the scores are running totals in order, and `edited` is `yes` or `no`.

- [ ] **Step 1: Write the failing tests:**
  - `escapes commas, quotes and newlines`: a name `O"Neil, Jr.\nX` round-trips quoted as `"O""Neil, Jr.\nX"`.
  - `book CSV keeps 00 distinct from 0`: a roster with #0 and #00 gives two player rows containing `#0` and `#00`.
  - Book: the per-period marks cell is `2 2 FT 0`; the TEAM TOTALS TP equals `derive().usTotal`; an unresolved period's reconcile row says `unresolved` and shows the diff.
  - Plays: there's one row per event in `order`, `us_score` climbs 2, 3, 6, and an edited event shows `yes`.
  - `exportFilename` for opponent `St. Mary's` on `2026-11-14` returns `bench-book_2026-11-14_st-mary-s_book.csv`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the three modules.
- [ ] **Step 4:** Run them again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): book-layout and play-by-play CSV export`

---

### Task 6: Storage

**Files:** Create `src/core/storage.ts`, `src/core/storage.test.ts`

**Interfaces:** Produces:

```ts
export const GAME_KEY = 'benchbook:game';
export const ROSTER_KEY = 'benchbook:roster';
export const GAME_TTL_MS = 72 * 60 * 60 * 1000;
export function loadGame(s: Storage, now: Date): Game | null;   // purges + returns null if now - updatedAt > TTL, or JSON invalid, or version !== 1
export function saveGame(s: Storage, g: Game): boolean;         // false on any throw (quota, private mode)
export function clearGame(s: Storage): void;
export function loadRoster(s: Storage): Player[];                // [] on missing/invalid
export function saveRoster(s: Storage, r: Player[]): boolean;
export function clearRoster(s: Storage): void;
export function hoursUntilPurge(g: Game, now: Date): number;
```

- [ ] **Step 1: Write the failing tests**, using an in-memory `Storage` fake:
  - A game saved and loaded at +71 h comes back; at +73 h it returns `null` and the key is removed.
  - Corrupt JSON returns `null` and doesn't throw.
  - `save reports failure instead of throwing`: if `setItem` throws `QuotaExceededError`, `saveGame` returns `false`.
  - The roster survives regardless of age, and `clearRoster` empties it.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `storage.ts`.
- [ ] **Step 4:** Run them again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): local persistence with 72h game retention`

---

### Task 7: Store and Setup screen

**Files:** Create `src/ui/store.ts`, `src/ui/Setup.tsx`; modify `src/ui/App.tsx`

**Interfaces:** Consumes Tasks 2, 6. Produces:

```ts
export type View = 'setup' | 'live' | 'log' | 'running' | 'reconcile' | 'end';
export function useGameStore(): { game: Game | null; saving: boolean /* last save succeeded */;
  view: View; setView(v: View): void;
  update(fn: (g: Game, now: Date) => Game, label: string): void;   // pushes the prior Game on the undo stack (max 50, memory only), applies, saves; label feeds the toast
  undo(): string | null;    // pops the stack, saves, returns the undone label ("#4 +2") or null when empty
  toast: { text: string; canUndo: boolean } | null;
  start(g: Game): void; discard(): void };
```

- [ ] **Step 1:** `useGameStore` loads with `loadGame(localStorage, new Date())` on mount. If a game exists, the view starts at `live`; otherwise at `setup`. Every `update`/`start` calls `saveGame`. If `localStorage` itself throws on access, fall back to memory with `saving: false`. On first start, call `navigator.storage?.persist?.()` once and ignore the result.
- [ ] **Step 2:** `Setup.tsx` has game info fields (opponent required, date defaulting to today, home/away toggle) and roster rows (POS, name, number) prefilled from `loadRoster`. It has "Add player", remove-row, and "Clear saved roster" controls. A "Track opponent score with live taps" checkbox, off by default, sets `trackOpponentTaps`. Validation: at least 1 player, numbers required and unique as strings (`0` ≠ `00`), at most 15 players. "Start game" calls `saveRoster` and then `start(newGame(...))`. On iOS (`/iPad|iPhone|iPod/` and not `navigator.standalone`), show a one-line hint: "Tip: Share → Add to Home Screen keeps your roster saved between games."
- [ ] **Step 3:** If a game already exists, Setup shows "A game is in progress (vs X). Export it first?" with buttons Export / Discard and start new / Cancel. Export is wired up in Task 10; until then the button routes to the `end` view.
- [ ] **Step 4:** In `App.tsx`, when `saving === false`, show a persistent amber banner on every view: "Not saving on this device — keep the paper book current."
- [ ] **Step 5:** Run `pnpm check`, then `pnpm dev` and manually enter a roster, reload the page, and confirm the roster is prefilled. Expected: check exits 0.
- [ ] **Step 6:** Commit: `feat(ui): game setup with remembered roster`

---

### Task 8: Live screen

**Files:** Create `src/ui/Live.tsx`, `src/ui/StatusStrip.tsx`, `src/ui/PlayerGrid.tsx`, `src/ui/EventSheet.tsx`

**Interfaces:** Consumes `useGameStore`, `derive`, `appendEvent`, `endPeriod`, `endGame`, `checkPeriod`, `playsCsv`, `exportFilename`, `periodLabel`, `oppTotal`.

- [ ] **Step 1: `StatusStrip`** is sticky at the top. It shows Us–Opp score, the period label, `Fouls N` (with an amber "OPP IN BONUS" chip once `oppInBonus`), and timeouts left as `Full x/3 · 30 x/2 · OT x/n`, where the OT part only appears in OT.
- [ ] **Step 2: `PlayerGrid`** shows each roster player as a ≥ 44 px button, in a 2-column grid on a phone and 3–4 columns on a tablet. Each button shows a large number, the name, the points, and 5 foul dots. `warn` gets an amber border and `out` gets a red border with an "OUT" label. Players marked out stay tappable.
- [ ] **Step 3: `EventSheet`** opens from the bottom after a player is tapped, with buttons `+2`, `+3`, `FT ✓`, `FT ✗`, `Foul`, `Tech`. One tap appends the event and closes the sheet, **except FT ✓/FT ✗, which keep it open on the same player** (free throws come in pairs; a "Done" button or tapping outside closes it). There are no confirmation dialogs. Every entry raises the store's toast ("#4 +2 · Undo") for ~4 s.
- [ ] **Step 4: The team bar** at the bottom of Live (two rows on a phone) has: `Timeout` (opens a choice of Full/30/OT, with OT only in OT periods), `Bench T`, `Opp +1/+2/+3` (only when `trackOpponentTaps`), `Undo` (store `undo()`, disabled when the stack is empty), `Log`, and `End Q1`/`End OT1`. **End period calls `endPeriod` immediately** with an Undo toast. After Q4 or any OT the button reads `End Q4…` and offers **Start OT** / **End game**.
- [ ] **Step 4b: The reconcile card.** While any ended period is `pending` or `unresolved`, Live shows a slim banner at the top: "Q1 not checked against the book — Check". It never covers the player grid. Tapping it opens the `reconcile` view for the oldest such period.
- [ ] **Step 4c: Temporary export.** A `⋯` menu holds "Export plays CSV" (`download(exportFilename(g,'plays'), playsCsv(g))`; create `src/ui/download.ts` with `download(filename: string, text: string): void` here — Blob + temporary `<a download>`), so the app can be trialed at a real game before Tasks 9–11 land.
- [ ] **Step 5:** Run `pnpm check`, then drive the app manually in `pnpm dev` with phone emulation (390×844). Score, foul and timeout taps should update the strip, and a reload should restore everything. Expected: check exits 0.
- [ ] **Step 6:** Commit: `feat(ui): live entry screen`
- [ ] **Step 7: Owner checkpoint (not code).** Keep the paper book and the app side by side at a real game, or over a recorded junior high game at 1× speed. Note any play that was missed or entered late, and what slowed it down. "Faster than paper" is the assumption the product rests on; this is where it gets measured. Fold the findings into Tasks 9–10 before building them.

---

### Task 9: Log screen (edit, delete, insert before)

**Files:** Create `src/ui/Log.tsx`

**Interfaces:** Consumes `orderedEvents`, `editEvent`, `deleteEvent`, `insertEventBefore`, `moveFrom`, `periodLabel`.

- [ ] **Step 1:** The log is grouped by period, newest period first, and in `order` within a period. Each row reads `#4 Player One · +2` (or `Opp +3`, `Timeout (Full)`, `Bench T`), with an "edited" tag when `editedAt` is set.
- [ ] **Step 2:** Tapping a row opens three actions: **Edit** (change the player, the event type, or move it to a different period), **Delete** (one-step, no confirmation; the toast's Undo restores it), **Move this and everything after to…** (`moveFrom`, for a missed "End Q"), and **Insert before** (the same player-then-event flow as Live, and the result goes into that event's period).
- [ ] **Step 3:** The Log accepts an optional `period` filter, which Reconcile uses to show one period's events.
- [ ] **Step 4:** Run `pnpm check` and verify manually. Expected: check exits 0.
- [ ] **Step 5:** Commit: `feat(ui): editable event log`

---

### Task 10: Reconcile, end game and export

**Files:** Create `src/ui/Reconcile.tsx`, `src/ui/EndGame.tsx`, `src/ui/download.ts`

**Interfaces:** Consumes `checkPeriod`, `saveReconcile`, `endGame`, `openIssues`, `bookCsv`, `playsCsv`, `exportFilename`, `hoursUntilPurge`, `download` (Task 8).

- [ ] **Step 1: The Reconcile view** (one period, opened from the card or a Log period header) asks for "Our points in Q1 (book's Score by Qtr box)" and "Opponent points in Q1" (prefilled from taps when tracked). Beside it, it shows the app's **cumulative** score through that period, so a scorer reading the running score can check without subtraction. A live comparison reads "Book 12 · App 10 — app is 2 short" or "✓ Matches". On a mismatch it shows that period's Log (Task 9's filter) inline for fixing in place, plus a Note field. **Foul glance:** it also lists each player's foul count and the period's team fouls, to compare with the book by eye (nothing is entered). Buttons: **Save** (`saveReconcile`) and **Later** (back to Live, record unchanged).
- [ ] **Step 2:** The Log's period headers carry a status chip (pending / matched / fixed / noted / unresolved) that opens the Reconcile view for that period.
- [ ] **Step 3: The EndGame view** shows the final score, then `openIssues` as a list. Each issue has a Note field and a "Reopen" link. "Finish" calls `endGame`, and is allowed even with issues still open (they stay `unresolved` in the export).
- [ ] **Step 4:** There are export buttons for **Book CSV** and **Plays CSV**, and each sets `exportedAt`. While `endedAt && !exportedAt`, the Live and Setup views show "Not exported — game data clears in N h" using `hoursUntilPurge`.
- [ ] **Step 5:** Wire Setup's "Export first" (from Task 7) to this view, and replace the temporary export in Task 8's `⋯` menu with `⋯ → End game / export`.
- [ ] **Step 6:** Run `pnpm check` and play a full manual game through Q4 → OT1 → End, then open both CSVs in a spreadsheet and confirm `#00` survives. Expected: check exits 0.
- [ ] **Step 7:** Commit: `feat(ui): period reconcile, end game and CSV export`

---

### Task 11: Offline (PWA) and Add-to-Home-Screen

**Files:** Modify `astro.config.mjs`; create `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (a simple generated "BB" mark; no third-party artwork)

- [ ] **Step 1:** Add `@vite-pwa/astro` with `registerType: 'prompt'` (apply an update only on the Setup screen, or when no game is loaded, via "Update available — reload"; never mid-game), `workbox.globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']`, and the manifest `name: 'Bench Book'`, `short_name: 'Bench Book'`, `display: 'standalone'`, `start_url: '/'`, plus the icons. **Pin it to an exact version** (2.0.2 accepted `astro ^5 || ^6 || ^7` on 2026-11-10, but the 2.x line is days old). **Fallback, if the build fails or `index.html` is missing from the precache:** remove it and run `workbox-build`'s `generateSW` against `dist/` as a post-build step (`"build": "astro build && node scripts/sw.mjs"`), registering through `workbox-window` with the same prompt-style update. Do not hand-roll a precache scheme, and do not use plain `vite-plugin-pwa` inside Astro (Astro writes HTML after Vite's client build, so the HTML is missed). Record which route you took in the commit message.
- [ ] **Step 2:** Add `<link rel="apple-touch-icon">` and `apple-mobile-web-app-capable` meta to `index.astro`.
- [ ] **Step 2b:** Add a Vitest test `src/core/precache.test.ts` › `service worker precaches index.html`, which reads `dist/sw.js` and asserts it references `index.html` (skip with a clear message if `dist/` is absent; run it after `pnpm build`).
- [ ] **Step 3:** Run `pnpm build && pnpm preview`. Load it once, switch the browser offline in DevTools, and reload. Expected: the app loads and a saved game resumes.
- [ ] **Step 4:** Commit: `feat: offline support and home-screen install`

---

### Task 12: End-to-end smoke test

**Files:** Create `playwright.config.ts` (webServer `pnpm build && pnpm preview`, the iPhone 13 project), `e2e/game.spec.ts`

- [ ] **Step 1: Write `e2e/game.spec.ts` › `scripted game reconciles and exports`.** It sets up the roster `#4 Player One`, `#00 Player Two`, `#0 Player Three` and the opponent `Test Opp`. In Q1 it taps #4 +2, #00 FT ✓, and #4 Foul ×4, then asserts the #4 button shows the warn state. It taps End Q1, opens the reconcile card, enters book `3`/opp `5`, and expects "Matches". In Q2 it taps #0 +3, ends Q2, and leaves its card unopened. In Q3 it taps #4 +2, then Undo, and expects the score back at 6. Next it reloads the page and expects the score `6` and the Q3 period label to be back. It ends the game and asserts that the open issues list Q2. Finally it exports Book CSV through Playwright's `download` event and asserts the file contains `#00` and a Q2 reconcile row with status `pending`.
- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 3:** Update README: dev commands, "Deploy: connect the repo in Netlify (build `pnpm build`, publish `dist`)", and the privacy statement (nothing leaves the device).
- [ ] **Step 4:** Commit: `test: end-to-end scripted game; docs: README`

---

### Task 13: Running-score view

**Files:** Create `src/ui/RunningScore.tsx`

**Interfaces:** Consumes `runningScore`. Reached from Live's `⋯ → Running score`.

*Last on purpose: least v1 value (the paper book already has one).*

- [ ] **Step 1:** Show a grid of cells 1–112 (and further if the score passes 112), 16 per row as in the book. A cell that a score landed on shows its mark (`/`, `X`, `●`) with the jersey number underneath. Points passed through by a 2 or 3 show a light fill. A cell with `endsPeriod` gets a heavy right border and the period label.
- [ ] **Step 2:** Run `pnpm check`. Expected: exit 0.
- [ ] **Step 3:** Commit: `feat(ui): running score grid`

---

## After the plan

Hooking up Netlify is an owner action: connect `jc731/bench-book` in the Netlify UI, and `netlify.toml` already holds the build settings. Do this once Task 13 is green.
