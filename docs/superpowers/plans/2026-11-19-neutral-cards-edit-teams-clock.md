# Neutral cards, usage counter, Edit teams, timeout clock (0.10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 0.10: neutral live cards, a per-game usage counter with a Usage CSV, Edit teams mid-game, and an opt-in timeout clock behind an Experiments page.

**Architecture:** Pure logic in `src/core/` (usage counts and CSV, the team-edit transform, the lineup's slot swap) and `src/ui/*-logic.ts` (clock math), each unit-tested; Preact views wire it through the existing `useGameStore`. The usage record and the clock live outside the `Game` object, so undo snapshots never touch them.

**Tech Stack:** Astro 5, Preact, Tailwind 4, Vitest, Playwright. pnpm.

**Spec:** `docs/superpowers/specs/2026-11-19-neutral-cards-edit-teams-clock-design.md` (decisions are cited as D1–D21, invariants as I1–I12).

## Global Constraints

- Commit straight to `master`; no branches. Commit messages carry no Claude/Anthropic attribution trailer. US English. Never push.
- `pnpm check` (astro check, tsc, vitest) passes at every commit. Run `pnpm test:e2e` for any task that touches the interface or `e2e/` (port clash: `E2E_PORT=<free port> pnpm test:e2e`).
- Colors have one job each (README § Colors): amber caution, red out, blue (sky) action/selection, white main button, green done, gray the rest. One border-color class per element. Update README § Colors with any change.
- One thumb, iPhone 13 (390 × 664). Tap targets at least 44 px. 10 players a side fit the live screen with no scroll.
- Test data uses invented names only (the repo is public). Gender-neutral wording.
- Every expected value in a test names its source (a spec decision `D<n>`/invariant `I<n>`, or an existing rule) in the test name or a comment.
- When user-visible work lands, add a bullet under `## [Unreleased]` in `CHANGELOG.md` (headings exactly as they are; every entry a `- ` bullet).
- Never weaken, skip or delete a test to get a pass without naming it in the commit message.

## Review Focus

1. A game in progress opened after upgrading (no usage record, prefs without `timeoutClock`) must load with zero counts and the clock off, never throw. → Task 3 and Task 6 tests.
2. Edit teams on a roster built mid-game through Whose number? (players with empty names, possibly an opponent with only a default `MM-DD` name) must save with no validation error for the empty names. → Task 5 test.
3. Undo right after an Edit teams save must restore the old roster and names exactly, and the usage record must still count the save and the undo. → Task 5 test (I6) and Task 4 test (I10).
4. The clock running while the scorer opens Log, a quarter check or Running score, then comes back: the time shown must have kept falling. → Task 6 unit test on `clockLeftMs` with a fake clock, and the e2e step.
5. Demo mode: the usage record and the experiment setting use demo keys, and "Reset demo" clears the demo usage record. → Task 3 test.

---

### Task 1: Neutral cards

**Files:**
- Modify: `src/ui/TeamHalf.tsx` (TONE table, `cardFor`, Sub button)
- Modify: `src/ui/live-logic.ts:34-43` (`subButtonText`, `subButtonAmber`), `src/ui/live-logic.ts:194-197` (`lineupSuffix`)
- Modify: `src/ui/live-logic.test.ts` (tests around lines 229–289)
- Modify: e2e specs that assert the removed texts (`grep -rn "now on the floor\|Sub · \|bench'" e2e/`)
- Modify: `README.md` § Colors (gray row; the amber row's "Sub · N on" mention if present)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: `subButtonText(l: Lineup): string | null` returns `null` (untracked), `'Starters'` (no play yet), else `'Sub'`. `subButtonAmber` is deleted. `lineupSuffix` is deleted and `playToast` no longer appends it.

- [ ] **Step 1: Update the unit tests first.** In `live-logic.test.ts`:
  - `subButtonText({...base, floor: 6 ids, changedUnseen: true})` → `'Sub'` (D3), and with 4 on → `'Sub'` (D3); `'Starters'` before the first play stays.
  - The toast test at line ~265 expects `'#22 (Home) +2'` (D4: the suffix goes).
  - Delete the `lineupSuffix` and `subButtonAmber` tests (their functions go; name this in the commit message).
- [ ] **Step 2:** Run `pnpm vitest run src/ui/live-logic.test.ts`. Expected: the changed tests FAIL.
- [ ] **Step 3: Implement.**
  - `live-logic.ts`: the new `subButtonText`; delete `subButtonAmber` and `lineupSuffix`, and remove the suffix from `playToast`.
  - `TeamHalf.tsx` (D1, D2): every non-out card uses the solid box `border-2 px-1 py-1` with the card fill and the `ok`/`warn`/`out` border. A card is *rest* when its position in `ordered` is `>= lineup.layoutFloor` and it isn't out: it uses a new `rest` fill token instead of `card` (light: `bg-slate-100 active:bg-slate-200`; dark: `bg-[#172033] active:bg-slate-700`). Out cards keep today's look. Delete the `ghost*`, `benchTag`, `subWarn` tokens and the "bench" tag span. The aria-label keeps `, bench` for a card not on `lineup.floor` (D1). The Sub button always uses `t.subOk`.
  - Update the component's doc comment (no "ghosted").
- [ ] **Step 4:** `pnpm check`, then `pnpm test:e2e`. Fix e2e assertions that expected "Sub · 6 on", the amber Sub, "now on the floor" or the "bench" tag text: change each to the new behavior, and list each changed assertion in the commit message.
- [ ] **Step 5: Look at it.** Run `pnpm dev:demo`, take a 390×664 screenshot of the live screen with 10 a side into the scratchpad, and confirm the fill step is visible on Home and (fainter) on Away, and nothing scrolls. Report the screenshot path.
- [ ] **Step 6: Docs.** README § Colors gray row: the cards are one style; cards after the top five are one fill step lighter on Home (slate-100) and darker on Away. Remove any "Sub · N on" amber mention. CHANGELOG: "Cards look the same whether a player is on the floor or the bench: the bench tag, the amber Sub · 6 on and "now on the floor" are gone. Cards after the top five are a shade lighter (Home) or darker (Away)."
- [ ] **Step 7: Commit** `Neutral cards: one card style, a fill step after the top five, Sub always gray`.

### Task 2: An incoming player takes the outgoing player's slot

**Files:**
- Modify: `src/core/lineup.ts:103-113` (the sub step)
- Test: `src/core/lineup.test.ts` (the test at ~line 194 "swaps them and regroups the layout floor-first")

**Interfaces:**
- Produces: `lineup()`'s `layout` after a sub follows D5. No signature change.

- [ ] **Step 1: Write the failing tests** (D5, I12), with a 10-player Home roster `h1..h10` in roster order, no plays:
  - `sub {ins:[h7], outs:[h2]}` → `layout` is `[h1,h7,h3,h4,h5,h6,h2,h8,h9,h10]`, `layoutFloor` 5. Assert exactly two positions differ from the previous layout (I12).
  - then `sub {ins:[h2], outs:[h4]}` → `[h1,h7,h3,h2,h5,h6,h4,h8,h9,h10]`.
  - unpaired: `sub {ins:[h8,h9], outs:[h3]}` from the start → floor `[h1,h2,h8,h4,h5,h9]` in that layout order (h8 in h3's slot, h9 at the end of the floor block), then the bench `[h6,h7,h3,h10]` (h3 in h8's old slot, the unpaired in stays absent from the bench).
  - unpaired out: `sub {ins:[], outs:[h2]}` → layout `[h1,h3,h4,h5,h2,h6,...]`: h2 moves to the front of the bench, `layoutFloor` 4.
  - Update the existing "regroups floor-first" test's expected layout to the new rule and say so in the commit message.
- [ ] **Step 2:** `pnpm vitest run src/core/lineup.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** in the sub branch of `lineup()`: start from the previous layout (`layout ?? rosterIds`, plus any roster ids not in it, at the end); for each `i < min(ins, outs)` whose `ins[i]` was applied and `outs[i]` was on the floor, swap their positions; then stable-partition: ids in `floor` first (layout order), then the rest (layout order), except that an unpaired out is placed first among the rest. Floor membership itself is unchanged from today.
- [ ] **Step 4:** `pnpm check` and `pnpm test:e2e`. Expected: PASS (update e2e card-order assertions only if one encodes the old regroup, and name it).
- [ ] **Step 5: Commit** `Lineup: an incoming player takes the outgoing player's slot`, with a CHANGELOG bullet "A sub swaps the two cards instead of regrouping the half."

### Task 3: Usage record (core)

**Files:**
- Create: `src/core/usage.ts`, `src/core/usage.test.ts`
- Modify: `src/core/keys.ts` (add `usagePrefix`), `src/ui/demo.ts` (`resetDemo` also clears demo usage records)

**Interfaces:**
- Produces:
  ```ts
  export type UsageKind = 'taps' | 'plays' | 'undos' | 'redos' | 'edits' | 'deletes' | 'lateAdds' | 'subs' | 'teamEdits';
  export type Usage = Record<UsageKind, number>;
  export const ZERO_USAGE: Usage;
  export function loadUsage(s: Storage, keys: StorageKeys, gameId: string): Usage;      // missing/corrupt → ZERO_USAGE; missing fields → 0
  export function bumpUsage(s: Storage, keys: StorageKeys, gameId: string, kind: UsageKind): Usage; // +1, saved, returned
  export function pruneUsage(s: Storage, keys: StorageKeys, keepId: string | null): void; // removes every usage key but keepId's
  export function fixes(u: Usage): number;           // undos + edits + deletes + lateAdds (D8)
  export function usageCsv(g: Game, u: Usage, version: string): string;
  export function usageFilename(g: Game): string;    // `bench-book_${date}_${slug(opponent)}_usage.csv`, same slug as exportFilename
  ```
  `StorageKeys.usagePrefix` is `benchbook:usage:` (real) / `benchbook-demo:usage:` (demo); the key is prefix + game id (D7).

- [ ] **Step 1: Write failing tests** in `usage.test.ts`:
  - `loadUsage` on an empty storage → `ZERO_USAGE`; on `'{"taps":3}'` → taps 3, the rest 0; on `'not json'` → `ZERO_USAGE` (Review Focus 1).
  - `bumpUsage` twice for `taps` → `loadUsage(...).taps === 2`; another game id stays 0.
  - `pruneUsage(s, keys, 'g2')` with records for g1 and g2 → g1's key gone, g2's kept, a non-usage key (`benchbook:roster`) untouched.
  - Demo keys: a bump with `storageKeys(true)` writes `benchbook-demo:usage:<id>` and not the real key; `resetDemo` removes it (Review Focus 5).
  - `fixes({...ZERO_USAGE, undos:2, edits:1, deletes:1, lateAdds:1, redos:5})` → 5 (D8: redos are not fixes).
  - `usageCsv`: header exactly `game_date,app_version,taps,plays,undos,redos,edits,deletes,late_adds,subs,team_edits,fixes,taps_per_play`, one data row; `taps_per_play` is taps/plays to 2 decimals, empty when plays is 0. With a game whose team, opponent and players have invented names, none of them appears in the CSV text (I11).
- [ ] **Step 2:** `pnpm vitest run src/core/usage.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** with the existing `safeRead`/`safeWrite`/`safeRemove` pattern of `src/core/storage.ts` (export them from there if they aren't). CSV quoting through `src/core/csv.ts`.
- [ ] **Step 4:** `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `Usage record: per-game counts outside the game, and a name-free Usage CSV`.

### Task 4: Usage counter wiring

**Files:**
- Modify: `src/ui/store.ts` (expose `bump`, count undo/redo, prune on load/start/discard)
- Modify: `src/ui/App.tsx` (one capturing click listener for taps)
- Modify: `src/ui/Live.tsx` (plays, subs), `src/ui/Log.tsx` (edits, deletes), `src/ui/Reconcile.tsx` (`addPlay` → lateAdds), `src/ui/EndGame.tsx` (Usage CSV button)
- Test: `e2e/usage.spec.ts` (new)

**Interfaces:**
- Consumes: Task 3's API.
- Produces: `store.bump(kind: UsageKind): void` (no-op with no game). `store.undo`/`store.redo` bump `undos`/`redos` when they change the game. Task 5 calls `bump('teamEdits')`; the 0.11 stats page will call `bump('lateAdds')` or `bump('plays')`.

- [ ] **Step 1: Write the failing e2e** `e2e/usage.spec.ts` (use `e2e/fixture.ts` helpers to start a game with invented players): record a +2 and a Foul from live, Undo, Redo, open Log and delete one play, go to Final, click **Usage CSV**, read the download. Assert from the spec's counting rules (D8): `plays` 2, `undos` 1, `redos` 1, `deletes` 1, `fixes` 2, `taps` ≥ the number of clicks the test made after Start game (count them in the test), and the CSV contains no player, team or opponent name (I11). Also assert the Book CSV / Plays CSV export marks are unchanged by the Usage download (D9).
- [ ] **Step 2:** `pnpm test:e2e e2e/usage.spec.ts`. Expected: FAIL (no Usage CSV button).
- [ ] **Step 3: Implement.**
  - Store: `bump` calls `bumpUsage` with the current game id and the store's keys. `undo()`/`redo()` bump when they returned a label. On mount, `start` and `discard`, call `pruneUsage(storage, keys, currentGameId ?? null)` (D7).
  - App: a `click` listener on `document` in capture phase, added once; when `(e.target as Element).closest('button')` and a game is open and `view !== 'setup'`, `bump('taps')` (D8).
  - Live: `record` and `add` bump `plays` (timeouts and bench techs are entries too); `recordSubs` bumps `subs`. Log: delete bumps `deletes`, a fix-sheet save bumps `edits`. Reconcile `addPlay` bumps `lateAdds`.
  - EndGame: a third button **Usage CSV** below the two exports, gray (`border border-slate-500`, not the white main button, since it isn't part of exporting the game), with the line "Taps and fixes for this game, no names." It calls `download(usageFilename(game), usageCsv(game, loadUsage(...), __APP_VERSION__))` and does **not** call `markExported` (D9).
- [ ] **Step 4:** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Unit-test I10** in `src/core/usage.test.ts` if not already pinned: a bump after loading never lowers any count (undo is store-level, so pin it in the e2e: after Undo, `plays` is still 2).
- [ ] **Step 6:** CHANGELOG: "Final offers a Usage CSV: taps, plays, undos, redos, fixes and late adds for the game, with no names." Commit `Usage counter: count taps and fixes per game; Usage CSV on Final`.

### Task 5: Edit teams

**Files:**
- Create: `src/core/edit-teams.ts`, `src/core/edit-teams.test.ts`
- Create: `src/ui/EditTeams.tsx`
- Modify: `src/ui/RosterEditor.tsx` (optional per-row lock), `src/ui/store.ts` (`View` gains `'teams'`), `src/ui/App.tsx` (render it; the wake lock already holds on any view but setup), `src/ui/Live.tsx` (More → Edit teams)
- Modify: `src/ui/howto-content.ts` (one line on Edit teams), `CHANGELOG.md`
- Test: `e2e/edit-teams.spec.ts` (new)

**Interfaces:**
- Consumes: `update(fn, label)`, `store.bump('teamEdits')` (Task 4), `validateRoster`/`cleanOppRoster`/`setupRosterErrors`/`opponentOrDefault` from `src/ui/roster.ts` (move what core needs into core or keep the validation call in the UI; core must not import from `src/ui`).
- Produces:
  ```ts
  export interface TeamsDraft { team: string; opponent: string; roster: Player[]; oppRoster: Player[] }
  export function teamsDraftOf(g: Game): TeamsDraft;
  export function lockedPlayerIds(g: Game): Set<string>;          // ids with any event or in any sub's ins/outs (D14)
  export function applyTeams(g: Game, d: TeamsDraft, now: Date): Game;
  // Keeps existing players' positions and ids (D12, D13): existing ids in their old order with new number/name,
  // removed unlocked ids dropped, new players appended. Throws if a locked id is missing from d.
  // opponent: opponentOrDefault(d.opponent, g.info.date) (D11). Clears `exported` (I6). events/subs untouched (I1).
  ```
  `RosterEditor` gains an optional prop `locked?: Set<string>`: a locked row's × is disabled and the row shows "has plays" in gray text (D14). New rows still append at the end; no reorder control (D13).

- [ ] **Step 1: Write failing unit tests** in `edit-teams.test.ts` (a game built with `newGame` + `appendEvent` + `recordSub`, invented names):
  - I1: `applyTeams` with renumbered and renamed players → `events` and `subs` deep-equal to before.
  - I2: `derive(before)` and `derive(after)` have equal totals, `byPeriod`, team fouls, timeouts and every player line's numbers.
  - I3: every event's `playerId` is on its side's roster after the save.
  - I4: `lineup(after, side).floor` equals `lineup(before, side).floor` after renumbering, renaming and adding a player to each side.
  - D13: an added player is last in `roster`; the existing order is unchanged.
  - D14: `lockedPlayerIds` contains a player with only a sub (no plays); `applyTeams` throws when a locked id is removed.
  - D11: a blank opponent becomes the `MM-DD` default; a typed one is trimmed.
  - I6: `exported` is cleared.
  - Review Focus 2: an opponent roster of numbers with empty names saves without error through the same validation Setup uses.
  - I5: `bookCsv` before/after differs only in lines holding a renamed/renumbered player; `playsCsv` rows keep the same `seq, period, team, event, points, us_score, opp_score` columns.
- [ ] **Step 2:** `pnpm vitest run src/core/edit-teams.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `edit-teams.ts`.
- [ ] **Step 4:** `pnpm vitest run src/core/edit-teams.test.ts`. Expected: PASS.
- [ ] **Step 5: Write the failing e2e** `e2e/edit-teams.spec.ts`: start a game, record a +2 for one player, open More → **Edit teams**; the scored player's × is disabled with "has plays"; rename that player, add a new player "#33" to the opponent, Save. Live shows the new name and a #33 card; the toast reads "Edited teams"; Undo restores the old name and removes #33 (I6, Review Focus 3). Cancel leaves the game unchanged.
- [ ] **Step 6: Implement the UI.** `EditTeams.tsx`: header "Edit teams", our team name input, opponent input, `RosterEditor` for ours ("Our roster") and theirs ("Their roster") with `locked`, the validation errors as Setup shows them, **Save** (white main button) and **Cancel** (gray). Save: `update((g, now) => applyTeams(g, draft, now), 'Edited teams')`, `bump('teamEdits')`, back to live. It never calls `saveRoster` (spec non-goal). Live's More menu gets **Edit teams** right after "Running score".
- [ ] **Step 7:** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 8: Docs.** How-to: one sentence where rosters are explained: "Fix a number, add a name or add a player mid-game: ⋯ → Edit teams." Update `src/ui/howto-content.test.ts` if it pins the text. CHANGELOG: "More → Edit teams fixes names, numbers and both rosters mid-game, without recording a play. A player with plays can't be removed."
- [ ] **Step 9: Commit** `Edit teams: fix both rosters and team names mid-game from More`.

### Task 6: Experiments page and the timeout clock

**Files:**
- Create: `src/ui/clock-logic.ts`, `src/ui/clock-logic.test.ts`, `src/ui/ClockBand.tsx`, `src/ui/Experiments.tsx`
- Modify: `src/core/storage.ts` (`Prefs` gains `timeoutClock: boolean`), `src/core/storage.test.ts`
- Modify: `src/ui/store.ts` (`View` gains `'experiments'`; clock state), `src/ui/App.tsx`, `src/ui/Live.tsx` (More item, timeout hook, band in place of the feedback line)
- Modify: `README.md` § Colors (amber: the clock's warning; red: the clock's Time), `CHANGELOG.md`
- Test: `e2e/clock.spec.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  // clock-logic.ts
  export const WARN_FRACTION = 0.5; // D19: halfway, one constant
  export interface Clock { kind: TimeoutKind; totalMs: number; endsAt: number | null; leftMs: number } // endsAt set = running
  export function newClock(kind: TimeoutKind): Clock;             // full/ot 60_000, thirty 30_000 (D16), not running (D17)
  export function startClock(c: Clock, now: number): Clock;
  export function pauseClock(c: Clock, now: number): Clock;
  export function resetClock(c: Clock): Clock;                    // full time, not running
  export function clockLeftMs(c: Clock, now: number): number;     // never below 0 (I8)
  export function clockPhase(c: Clock, now: number): 'ready' | 'running' | 'paused' | 'warn' | 'time';
  export function clockText(ms: number): string;                  // m:ss, rounding up (59_001 → "1:00", 0 → "0:00")
  export function warnText(c: Clock): string;                     // "15 seconds" for a 30, "30 seconds" for a full (D19)
  ```
  `phase` is `warn` when running or paused with `0 < left <= totalMs * WARN_FRACTION`, `time` at 0.
  Store: `clock: Clock | null`, `setClock(c: Clock | null)`. Plain state, never in the game, never saved (D18, I7).

- [ ] **Step 1: Write failing unit tests** in `clock-logic.test.ts` with explicit `now` numbers: `newClock('thirty')` shows "0:30" and is `ready`; started at t=0, at t=14_000 `running` "0:16", at t=15_000 `warn` "0:15", at t=31_000 `time` "0:00" and `clockLeftMs` 0 (I8); pause at 10_000 then `clockLeftMs` at 50_000 is 20_000 (paused time doesn't fall); restart at 50_000 and at 70_000 it reads `time`; a full clock warns at 30_000 left; `resetClock` gives full time, not running. Review Focus 4: a running clock read at a later `now` with no calls in between has fallen by exactly the elapsed time. In `storage.test.ts`: `loadPrefs` of the old shape `{"trackOpponentTaps":false}` gives `timeoutClock: false`; a saved `true` round-trips (Review Focus 1).
- [ ] **Step 2:** `pnpm vitest run src/ui/clock-logic.test.ts src/core/storage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `clock-logic.ts` and the `Prefs` change.
- [ ] **Step 4:** Unit tests PASS.
- [ ] **Step 5: Write the failing e2e** `e2e/clock.spec.ts` with Playwright's `page.clock` (install a fake clock before load):
  - Default: tap Home's 30 → no clock band (I9).
  - More → **Experiments** → turn **Timeout clock** on → Back. Tap Home's 30 → the band shows "0:30" and the feedback line is hidden; tap a player card → the play sheet opens (D17: nothing blocks).
  - Tap **Start**, advance 15 s → "0:15" and the note "15 seconds"; open Log, advance 5 s, come back → "0:10" (D18).
  - Advance past 0 → "Time"; tap × → the band is gone and the feedback line is back.
  - The game's `updatedAt` / export state is unchanged by Start/Pause/Reset/× (I7): read the saved game from `localStorage` before and after.
- [ ] **Step 6: Implement the UI.**
  - `Experiments.tsx`: title "Experiments", a line "Settings on this phone only. They may change or go away.", one toggle row **Timeout clock** with the text "Taking a timeout opens a 60 or 30 second clock." (on = sky, as other selections), and Back. Saves through `savePrefs` with the store's keys.
  - Live's More: a gray, smaller **Experiments** item at the foot (after New game / Reset demo) (D15).
  - Live: `takeTimeout` (used by the timeout buttons and "Take anyway") also calls `setClock(newClock(kind))` when `loadPrefs(...).timeoutClock` is on (D16). Undo doesn't touch the clock (D21).
  - `ClockBand.tsx`, shown on Live in place of `FeedbackLine` while `clock` is set (D17): the time in large tabular numbers, the warning note, **Start**/**Pause** (blue: the action), **Reset**, **×**; buttons at least 44 px; it re-renders every 250 ms with `setInterval` while mounted. Colors (D20): time white while running, amber in `warn`, red **Time** at 0. Must fit 390 px in one row of ≤ 56 px.
- [ ] **Step 7:** `pnpm check` and `pnpm test:e2e`. Expected: PASS. Take a 390×664 screenshot of the band in `warn` into the scratchpad and report its path.
- [ ] **Step 8: Docs.** README § Colors: amber gains "the timeout clock's last half", red gains "the timeout clock's Time". CHANGELOG: "More → Experiments: an opt-in timeout clock (off by default). Taking a timeout shows a 60 or 30 second countdown above the bottom bar, with a note at halfway and Time at 0:00." The How-to doesn't mention it (spec).
- [ ] **Step 9: Commit** `Experiments page with an opt-in timeout clock`.

### Task 7: Backlog notes and release readiness

**Files:**
- Modify: `README.md` § Backlog
- Modify: `CHANGELOG.md` (check the Unreleased bullets read as one release)

- [ ] **Step 1: README backlog edits** (no code):
  - "Before 1.0" entry for neutral cards and starters: mark neutral cards done (0.10); the starters toggle moves to a new entry "Starters and the lineup: revisit" — the owner is still torn after the 2026-11-18 game (2026-11-19); trigger: the owner settles what the lineup should do, then design it again with mockups.
  - 1.1 efficiency: add "One-tap +2/+3/Foul can't fit 44 px on today's 88 px cards (measured 2026-11-18), so 1.1 needs its own layout decision"; and "Tap volume still felt high at the 2026-11-18 game (owner); 0.10's Usage CSV gives the baseline."
  - Recorded, not planned: "The quarter check compares team fouls too. Trigger: a second real game with a missed foul." and "Merge a stray number into the real player in Edit teams. Trigger: a stray number with more than about 2 plays."
- [ ] **Step 2:** `pnpm check`. Commit `Backlog: starters to revisit, 1.1 card geometry, tap volume, team-foul check`.

## Invariants (spec I1–I12) and where each is checked

| | Check |
|---|---|
| I1–I6 | `src/core/edit-teams.test.ts` (Task 5); I6's undo half in `e2e/edit-teams.spec.ts` |
| I7 | `e2e/clock.spec.ts` (saved game unchanged by the clock) |
| I8 | `src/ui/clock-logic.test.ts` |
| I9 | `e2e/clock.spec.ts` default case; `/ux-audit` uses a fresh profile, so the default holds there by construction |
| I10 | `e2e/usage.spec.ts` (plays still 2 after Undo) |
| I11 | `src/core/usage.test.ts` and `e2e/usage.spec.ts` |
| I12 | `src/core/lineup.test.ts` (Task 2) |

Release (controller, after the final review): `pnpm release minor` → 0.10.0. Don't push without the owner's go-ahead.
