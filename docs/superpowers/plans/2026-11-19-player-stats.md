# Player stats page (0.11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 0.11: the bottom bar's Log becomes **Book**, opening a per-player, per-quarter grid of points and fouls for each team, where a cell's plays can be fixed and a missing play added to that quarter in one tap.

**Architecture:** Core gains a `late` flag on events (a late add never promotes a bench player) and `foulsByPeriod` on player lines. A pure `src/ui/stats-logic.ts` builds the grid model and the add feedback from `derive`/`checkPeriod`. The Log's fix sheet is extracted so the Plays tab and the cell sheet open the same one (the spec's anti-goal: one way to edit a play).

**Tech Stack:** Astro 5, Preact, Tailwind 4, Vitest, Playwright. pnpm.

**Spec:** `docs/superpowers/specs/2026-11-19-player-stats-design.md` (decisions D1–D14, invariants I1–I7).

## Global Constraints

- Commit straight to `master`; no branches. Commit messages carry no Claude/Anthropic attribution trailer. US English. Never push.
- `pnpm check` passes at every commit. Run `pnpm test:e2e` for any task that touches the interface or `e2e/` (port clash: `E2E_PORT=<free port> pnpm test:e2e`). Known flake: `e2e/demo.spec.ts` "Demo marker covers no visible button" has failed under load; rerun it alone and say so.
- Colors have one job each (README § Colors): amber caution, red out, blue (sky) action/selection, white main button, green done, gray the rest. No new color job (D8). Update README § Colors if a use is added.
- One thumb, iPhone 13 (390 × 664). Tap targets at least 44 px; grid rows 48 px.
- Every play names its team in feedback and the Log (`#5 (Home)`).
- The Book and Plays CSV formats don't change. The `late` flag is not exported.
- Test data uses invented names only. Gender-neutral wording.
- Every expected value in a test names its source (`D<n>`/`I<n>` or an existing rule).
- When user-visible work lands, add a bullet under `## [Unreleased]` in `CHANGELOG.md`.
- Never weaken, skip or delete a test to get a pass without naming it in the commit message.

## Critique (2026-11-19) and rulings

An adversarial read of this plan (scratchpad `v011/plan-critic.md`) found ten points; each is folded into the tasks below:
1. The out line must not be clipped or lose its red: CellSheet draws its own wrapping, toned feedback line; `PlayButtons` (the six buttons + out gate) is extracted from `EventSheet` and shared (Task 4).
2. The strip shows the opponent's score as `oppTotal(g)` (book total + later taps), so the Score row can't always equal it. Ruling: the Score row is the app's recorded running score (the sum of the Team rows); spec I3 is amended to "equals the strip's score unless a saved check typed an opponent total that differs from their recorded points" and the test covers both cases (Task 2).
3. The check's Add play also uses `addFeedback` (Tell the official) and the out gate (Task 4).
4. Labels are built from the game the updater receives, not the rendered one (Task 4).
5. The "check now N over" suffix uses the check whose span covers the period, not only the period's own record (Task 2).
6. e2e: after the add that fouls out, the out warning shows, Undo stays reachable and unlocks; one opponent-side add (Task 4).
7. I1–I3 and I7 also run over every event prefix of a long generated game with OT and a legacy `OPP_PTS`; I6 is asserted in a unit test via `applyLabeled` (Task 2).
8. `late` survives an edit or move (pinned; Task 1).
9. Every user-facing "Log" string becomes "Book" (Task 3).
10. The Score row reuses `running-logic.ts` if it already computes the running score.
Not built: a link from the quarter check to Book → Players. Trigger: the owner reaches for it at a break.

## Review Focus

1. A game saved before 0.11 (events with no `late`) loads, derives and shows the grid; `late` absent means not late. → Task 1 test.
2. An add to the **current** quarter of a game in progress promotes a bench player exactly as a live tap does (D10); only earlier quarters, or any quarter of an ended game, are late. → Task 1 test on `isLateAdd` and Task 2 test.
3. A team with plays but no roster (opponent tracked only through No number) shows a grid of just No number, Team and Score, and the sums still hold. → Task 2 test.
4. OT columns: a game in OT1 shows an OT1 column with no plays in it; a game ended in Q4 shows none (D3). → Task 2 test.
5. Adding a play to a player who is already out shows the same out warning and "Enter a play anyway" gate as the live play sheet. → Task 4 e2e.

---

### Task 1: The `late` flag and `foulsByPeriod`

**Files:**
- Modify: `src/core/types.ts` (`GameEvent.late?: true`)
- Modify: `src/core/lineup.ts` (promotion skips late plays)
- Modify: `src/core/derive.ts` (`PlayerLine.foulsByPeriod`)
- Create: `src/core/late.ts` (`isLateAdd`)
- Modify: `src/ui/Reconcile.tsx` (`addPlay` sets `late` per `isLateAdd`; bumps `lateAdds` only when late, else `plays`)
- Test: `src/core/lineup.test.ts`, `src/core/derive.test.ts`, `src/core/late.test.ts`, `src/core/csv.test.ts` (or wherever the Plays CSV is tested)

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  interface GameEvent { /* ... */ late?: true } // added after its quarter; never promotes (D11). Not exported.
  // late.ts
  export function isLateAdd(g: Game, period: number): boolean; // !!g.endedAt || period < g.currentPeriod (D10, D11)
  // derive.ts
  interface PlayerLine { /* ... */ foulsByPeriod: Record<number, number> } // FOUL + TECH per period, same as `fouls` (I7)
  ```

- [ ] **Step 1: Failing tests.**
  - `lineup.test.ts` (D11, I5, audit 0.9.0 F1): with `h1..h10` (floor `h1..h5`), a `FG2` for `h7` in Q1 with `late: true` while the game is in Q2 → `h7` is not on the floor and `justIn` is null; the same play without `late` puts `h7` on the floor (today's rule). A late 5th foul on floor player `h3` → `h3` is out and off the floor (late adds still count toward fouls). A late play never adds anyone to the floor (I5): floor after ⊆ floor before.
  - `late.test.ts`: `isLateAdd` is false for `period === currentPeriod` of a game in progress (D10), true for an earlier period, true for any period once `endedAt` is set (D13).
  - `derive.test.ts` (I7): fouls in Q1 and Q3 and a TECH in Q3 → `foulsByPeriod` `{1:1, 3:2}`, and the sum over periods equals `fouls`; the No number line gets `foulsByPeriod` too. Review Focus 1: a game whose events carry no `late` field derives exactly as before (compare to a stored expectation built from the existing fixture).
  - Critique 8: a late play edited (`editEvent`) or moved (`moveFrom`) keeps `late` and still doesn't promote; say so in the `types.ts` comment.
  - CSV: an event with `late: true` produces the same Plays CSV row as the same event without it (Global Constraints).
- [ ] **Step 2:** `pnpm vitest run src/core`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `lineup()`: `if (!e.late && isPromotingPlay(e, out.has(pid)) && !floor.includes(pid))`. `derive`: add `foulsByPeriod` beside `pointsByPeriod`, counted where `fouls` is. `EventDraft` already derives from `GameEvent`, so `appendEvent` carries `late` through. Reconcile's `addPlay`: `const late = isLateAdd(game, period)`; pass `...(late ? { late: true as const } : {})`; `store.bump(late ? 'lateAdds' : 'plays')` (0.10 D8, spec D14).
- [ ] **Step 4:** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `Late adds: a play added after its quarter never puts a bench player on the floor`, with a CHANGELOG bullet "A play added to an earlier quarter from the check no longer moves that player onto the floor (audit 0.9.0 F1)."

### Task 2: The grid model and the add feedback (pure)

**Files:**
- Create: `src/ui/stats-logic.ts`, `src/ui/stats-logic.test.ts`

**Interfaces:**
- Consumes: `derive`, `PlayerLine.foulsByPeriod` (Task 1), `checkPeriod` (`src/core/reconcile.ts`), `homeSide`/`sideName`/`rosterOf` (`src/core/events.ts`), `periodLabel` (`src/core/periods.ts`), `foulToast`/`playLabel`/`who`/`namedWho` (`src/ui/live-logic.ts`), `addedLabel` (`src/ui/log-logic.ts`), `isLateAdd` (Task 1).
- Produces:
  ```ts
  export interface StatsCell { points: number; fouls: number; empty: boolean }        // empty: no play at all that period (D6)
  export interface StatsRow {
    key: string;                 // player id, or 'none' for No number
    player: Player | null;       // null for No number
    cells: StatsCell[];          // one per column of `periods`
    points: number; fouls: number; techs: number;
    foulState: 'ok' | 'warn' | 'out';
  }
  export interface StatsGrid {
    side: Side;
    periods: number[];           // 1..max(4, currentPeriod) (D3)
    rows: StatsRow[];            // roster order, then No number when that team has a no-number play (D4)
    team: { points: number[]; fouls: number[]; total: number; totalFouls: number };  // per period, + totals
    score: { home: number[]; away: number[] };  // running score after each period (D4); last = the strip's score
  }
  export function statsGrid(g: Game, side: Side): StatsGrid;
  export function sideOrder(g: Game): Side[];              // Home first (D2)
  export function totalText(r: StatsRow): { points: string; fouls: string; tech: string | null };
    // fouls: `F 3`, `F 4` (warn), `OUT` (out); tech: `T 1` when techs > 0, else null (D7)
  export function cellTitle(g: Game, side: Side, player: Player | null, period: number): string;
    // `#5 Casey Moreno (Home) · Q2`; No number → `No number (Home) · Q2` (D9)
  export function cellPlays(g: Game, side: Side, playerId: string | null, period: number): GameEvent[]; // oldest first (D9)
  export function addToCell(g: Game, side: Side, playerId: string | null, type: PlayType, period: number, now: Date): Game;
    // appendEvent at the end of `period`, `late` per isLateAdd (D10, D11)
  export function addFeedback(before: Game, after: Game, side: Side, player: Player | null, type: PlayType, period: number):
    { text: string; tone: 'plain' | 'amber' | 'red' };
  ```
  `addFeedback` (D12): if the add puts the player out → `foulToast`'s out text (`#5 Casey Moreno (Home) out, 5 fouls. Tell the official.`), tone `red`. Else the base `addedLabel(type, who(player, tag), period)` (`Added #5 (Home) Foul to Q2`), plus the bonus suffix ` — bonus` when the add puts the other team in the bonus **for the current period** (`teamFoulsForBonus(currentPeriod)` crossing 5), plus ` · Q2 check now 2 over` (or `short`) when the saved check **covering period p for this side** (the first period ≥ p with a typed book total for that side; its span starts after the previous typed total, so it covers p) matched before (`diff === 0` for us / `bookOppSpan === oppTapped` for the opponent) and doesn't after — the suffix names that check's period; tone `amber` when the check suffix is present, else `plain`. Over = the app has more than the book.

- [ ] **Step 1: Failing tests** (invented players; build games with `newGame` + `appendEvent`):
  - I1: for each team and period, the player rows plus No number sum to `team.points[p]`.
  - I2: for each team and period, player rows' fouls + No number fouls + bench techs in that period = `team.fouls[p]`.
  - I3 (amended, critique 2): `score` is the running sum of both teams' `team.points`; its last entry equals the strip's Home–Away score (`derive` for us, `oppTotal(g)` for them) when no typed opponent total disagrees; with a saved check whose typed opponent total differs from their recorded points, the Score row shows the recorded points (and the test says so).
  - Critique 7: I1, I2, I3 and I7 hold for every event prefix of a generated game of 60+ events across Q1–OT1 with subs, both teams, No number plays, a bench tech and one legacy `OPP_PTS`.
  - I6: `applyLabeled(state, (g) => addToCell(...))` (`src/ui/game-state.ts`) on an exported, ended game leaves `endedAt` and clears `exported`.
  - I4: `addToCell` to period 2 changes only column 2 and the totals of that row, the Team row's column 2 and totals, and `score` from column 2 on (diff the two grids).
  - D3 / Review Focus 4: a game in period 5 has `periods` `[1,2,3,4,5]` with an empty column 5; an ended Q4 game has `[1,2,3,4]`.
  - D4 / Review Focus 3: the opponent with no roster and two No number plays → `rows` is one No number row; I1 holds.
  - D6: a quarter with only a missed free throw → cell `{points: 0, fouls: 0, empty: false}`; no plays → `empty: true`.
  - D7: `totalText` for 3 fouls `F 3`, 4 fouls warn, 5 fouls `OUT`, 1 tech `T 1`.
  - D10 / Review Focus 2: `addToCell` of `FG2` for bench player `h7` in the current period of a game in progress puts `h7` on the floor (`lineup`); the same to an earlier period does not.
  - Critique 5: Q2 has no saved check, Q3's check (span Q2–Q3) matched → an add to Q2 gives ` · Q3 check now 2 over`; a Foul added to a matched quarter gives no suffix (checks compare points).
  - D12: a 5th foul added to Q2 → red out text ending `Tell the official.`; an add that breaks a matched Q2 check (book typed equal to the app) → `Added #5 (Home) +2 to Q2 · Q2 check now 2 over`, amber; the opponent's 5th team foul of the current period → base text + ` — bonus`.
- [ ] **Step 2:** `pnpm vitest run src/ui/stats-logic.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `stats-logic.ts` from `derive` (`team.players`, `team.noNumber`, `byPeriod`, `teamFoulsByPeriod`). Bench techs are in `teamFoulsByPeriod` and not in any row.
- [ ] **Step 4:** `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `Stats grid model: points and fouls by player and quarter, and the add feedback`.

### Task 3: Book with Players and Plays tabs (the read-only grid)

**Files:**
- Create: `src/ui/Book.tsx` (tabs + toggle + grid), `src/ui/FixSheet.tsx` (the Log's `EditSheet` and its save/delete/bump logic, moved out of `Log.tsx`)
- Modify: `src/ui/Log.tsx` (uses `FixSheet`; unchanged behavior), `src/ui/App.tsx` (`view === 'log'` renders `Book`), `src/ui/Live.tsx` (bottom bar `Log` → `Book`)
- Modify: e2e specs that click the bottom bar's **Log** (`grep -rn "'Log'\|name: 'Log'\|/\\^Log" e2e/`)
- Test: `e2e/book.spec.ts` (new)

**Interfaces:**
- Consumes: Task 2's `statsGrid`, `sideOrder`, `totalText`, `sideName`.
- Produces: `FixSheet({ store, event, onClose })` — the same sheet the Log opens, with the same save, delete, "also move" and usage bumps (`edits`, `deletes`); Task 4 opens it from a cell. `Book` keeps its tab (`'players' | 'plays'`) and side in module state so they survive leaving and returning until reload (D1, D2).

- [ ] **Step 1: Failing e2e** `e2e/book.spec.ts`: start a game with invented players on both teams; record a +2 and a Foul for Home #5 in Q1 and a +3 for Away #10. Tap **Book** → the Players tab is selected (D1), Home is selected (D2), the toggle shows each team's name and score; Home #5's Q1 cell reads `2` with one foul dot; the total cell reads `2` and `F 1`; the Team row's Q1 is 2 with 1 foul; the Score row's Q1 reads Home–Away `2–3` (I3). Switch to Away → #10's Q1 is `3`. Tap **Plays** → today's Log list. Leave with Back, open Book again → Plays and Away are still selected (D1, D2). The grid has no horizontal scroll at 390 px with Q1–Q4 (D3).
- [ ] **Step 2:** `pnpm test:e2e e2e/book.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Extract `FixSheet` with no behavior change; `Log` uses it. Run the existing Log e2e before going further.
  - `Book.tsx`: header with Back and the title **Book**; a two-segment tab (Players | Plays, selection in sky per the Colors table); under Players, a Home | Away toggle (each `Name 12`), then the grid: player column 78 px (`#N` over the truncated name, 3 px left bar: gray, amber at warn, red out — D5), period columns (`periodLabel`), total column 56 px (points, then `F n` amber at 4 / red **OUT**, then `T n` — D7). Cells: points large over one dot per foul; `·` faint when empty (D6). Rows 48 px; header and toggle pinned, rows scroll (D4). Home rows light and Away rows dark, as on Live (D2). Footer rows **Team** and **Score** not tappable. Past OT2 the grid scrolls sideways (D3). Plays tab renders `<Log embedded ... />` content as today's Log does.
  - Live's bottom bar button text **Book**; its accessible name `Book`.
  - `grep -rn "\bLog\b" src e2e`: every user-facing "Log" (e.g. `UNDO_CLEARED_LABEL` in `live-logic.ts`, How-to text and alt text) becomes "Book"; list them in the commit.
  - Update every e2e that clicked **Log** to click **Book** then the **Plays** tab where it needs the list; list each in the commit message.
- [ ] **Step 4:** `pnpm check` and `pnpm test:e2e`. Expected: PASS. Take a 390×664 screenshot of Book → Players with 10 a side mid-game into the scratchpad and report its path.
- [ ] **Step 5: Commit** `Book: Players (points and fouls by quarter) and Plays tabs`.

### Task 4: The cell sheet: list and add

**Files:**
- Create: `src/ui/CellSheet.tsx`
- Modify: `src/ui/Book.tsx` (cells open it)
- Test: `e2e/book.spec.ts`

**Interfaces:**
- Consumes: Task 2's `cellTitle`, `cellPlays`, `addToCell`, `addFeedback`, `isLateAdd`; Task 3's `FixSheet`; `store.update`, `store.bump`; `EventSheet`'s six play buttons and its `out` gate (`src/ui/EventSheet.tsx`), `eventRowText` (`src/ui/log-logic.ts`).

- [ ] **Step 1: Failing e2e** in `e2e/book.spec.ts`:
  - The owner's missed foul (spec Why, I5): Home #5 has 4 fouls and is on the floor in Q4; Book → #5's Q2 cell → sheet titled `#5 <name> (Home) · Q2` (D9) → **Foul** → the feedback reads `#5 <name> (Home) out, 5 fouls. Tell the official.` in red, the list gains the play, the sheet stays open (D9); **Done** → #5's total reads **OUT**; back on Live #5's card is out and off the floor, and no bench player joined the floor (I5).
  - A late `+2` for a bench player in Q1 while in Q2: the player stays on the bench (D11).
  - Tap a listed play → the Log's fix sheet opens (D9); change +2 to +3, save → the cell updates.
  - Undo in the sheet's feedback line removes the last add (D10: one undo step).
  - Critique 6: right after the add that fouls #5 out, the out warning shows, the red line is fully visible (`scrollWidth <= clientWidth` at 390×664), Undo is reachable, and Undo unlocks the buttons.
  - One opponent add: Away #10's Q1 cell → +2 → `Added #10 (Away) +2 to Q1`.
  - The quarter check's Add play: a 5th foul added there reads `... out, 5 fouls. Tell the official.` (critique 3).
  - Ended game: End the game, open Book, add a foul to Q3 → Final shows "Not exported" again and the game is still ended (D13, I6).
  - Review Focus 5: a player already out → the cell sheet's buttons are locked behind the out warning; "Enter a play anyway" unlocks them.
  - Usage (D14): after one late add and one current-quarter add, the Usage CSV shows `late_adds` 1 and `plays` +1.
- [ ] **Step 2:** `pnpm test:e2e e2e/book.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Extract `PlayButtons({ out, onPlay })` (the six buttons and the out gate) from `EventSheet.tsx`; `EventSheet` uses it unchanged. `CellSheet.tsx` (a `Sheet`): a line with the quarter's points and fouls and the game totals; the cell's plays oldest first, each a button opening `FixSheet`; **Add to Q2** with `PlayButtons`; its own feedback line that wraps (never truncates), red or amber per `addFeedback`'s tone (tone kept in CellSheet state), with Undo; **Done**. Each add builds its label from the game the updater receives: `update((g, now) => { const after = addToCell(g, side, playerId, type, period, now); return { game: after, label: addFeedback(g, after, side, player, type, period).text }; })` — if `update` takes a fixed label today, add this form (see how `playToast` is wired in `Live.tsx`). `bump(isLateAdd(game, period) ? 'lateAdds' : 'plays')`. Reconcile's Add play uses the same `addFeedback` label and passes the `out` gate. The footer rows and total cells don't open it (D9).
- [ ] **Step 4:** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `Book: a cell lists its plays and adds a missing one to that quarter`.

### Task 5: Docs and the checklist

**Files:** `src/ui/howto-content.ts` (+ its test if it pins text), `README.md` (Book replaces Log wherever the bottom bar is described; § Colors only if a use was added), `CHANGELOG.md`, `CLAUDE.md` (tick the player stats item `[x] ... (0.11)`).

- [ ] **Step 1:** How-to: rename Log to Book where the bar is described; one short paragraph: "Book → Players shows each player's points and fouls by quarter, for either team, like the book's rows. Tap a quarter to see its plays, fix one, or add a missing one to that quarter." Keep the existing screenshot filenames; `pnpm release` refreshes them.
- [ ] **Step 2:** CHANGELOG: "Log is now Book. Its Players tab shows each player's points and fouls by quarter for either team; tap a quarter to fix a play or add a missing one there. A 5th foul added late says Tell the official, as on the live screen."
- [ ] **Step 3:** `pnpm check`, `pnpm test:e2e`. Commit `Docs: Book replaces Log; the 1.0 player stats item is done`.

## Invariants (spec I1–I7) and where each is checked

| | Check |
|---|---|
| I1, I2, I3, I4 | `src/ui/stats-logic.test.ts` (Task 2); I3's strip half also in `e2e/book.spec.ts` (Task 3) |
| I5 | `src/core/lineup.test.ts` (Task 1) and `e2e/book.spec.ts` (Task 4) |
| I6 | `endedAt` in `stats-logic.test.ts` (Task 2); `exported` cleared in `e2e/book.spec.ts` (Task 4) |
| I7 | `src/core/derive.test.ts` (Task 1) |

Release (controller, after the final review): `pnpm release minor` → 0.11.0. Don't push without the owner's go-ahead.
