# Active Lineup and Demo Mode (0.9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show who is on the floor for each team (solid floor cards, ghosted bench), let the scorer sub deliberately or fix a forgotten sub in one or two taps without the app ever guessing, and add a `?demo` mode with its own storage.

**Architecture:** A pure `lineup(game, side)` in `src/core/lineup.ts` derives the floor by replaying plays and stored subs (`Game.subs`, in/out lists anchored in the plays' order). `TeamHalf` renders from it; a new `SubSheet` records subs. Demo mode swaps the storage key prefix when the address has `?demo`.

**Tech Stack:** Astro 5 + Preact, Tailwind 4, Vitest, Playwright (iPhone 13), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-17-active-lineup-design.md` (decisions cited as D1…D19, plus D2a, D11a).

## Global Constraints

- US English everywhere; no Claude/Anthropic trailer on commits; invented names only (the repo is public).
- Colors per `README.md` § Colors: amber = caution, red = out, blue = the action to take, white fill = main button, green = done, gray = the rest. No new color job. Home cards light, Away dark.
- Tap targets ≥ 44 px. iPhone 13 (390 × 664): 10 players + controls per half fit without scrolling.
- The lineup never changes scores, fouls, player lines, the quarter's status, the CSVs, the running score, or any count of plays. Subs never appear in the CSVs or the Log.
- Copy fixed by the spec:
  - Sub button: `Starters` / `Sub` / `Sub · 6 on` / `Sub · 4 on`.
  - Play-sheet rows: `#22 checks in` / `#10 comes out`.
  - Sheet titles: `Who went out?` / `Who came in?` / `Who's on the floor?`.
  - Sheet tags and labels: `just in`, `likely`, `On the floor` / `On the bench`, count `5 on the floor`, button `Done`.
  - Card tag: `bench`.
  - Toasts: `· now on the floor` (appended), `#22 (Home) in for #10`, `Home floor updated`, `#12 (Home) out, 5 fouls. Tell the official.` (or `2 techs`).
  - Demo: marker `Demo`, menu item `Reset demo`.
- Gate: `pnpm check` before every commit; `pnpm test:e2e` for any change to `src/ui/` or `e2e/` (`E2E_PORT=4401` if 4400 is busy).
- Games saved before 0.9 load with no subs and replay their floor from the first five and their plays.

## Review Focus

1. **A Log correction around a sub:** a +2 credited to bench #3 (promoting her), then a sub, then the +2 moved to #33 in the Log. Expected: #3 is no longer promoted; the sub re-applies to the corrected floor, and parts that no longer apply are skipped. Pinned in Task 1.
2. **A bench player's free-throw pair.** Expected: the first shot promotes her, the second changes nothing, and the toast says "now on the floor" once. Pinned in Tasks 1 and 3.
3. **A tech on a bench player, or a play entered anyway for an out player.** Expected: no promotion. Pinned in Task 1.
4. **Mid-play card stability.** Expected: a promotion or foul-out changes a card's style in place, nothing reorders until a sub is recorded. Pinned in Task 4.
5. **Demo mode with a real game in progress on the phone.** Expected: `?demo` neither reads nor writes the real keys, and the real game is intact without `?demo`. Pinned in Task 6.

---

### Task 1: `lineup()` — the derived floor

**Files:**
- Create: `src/core/lineup.ts`, `src/core/lineup.test.ts`
- Modify: `src/core/types.ts` (Sub, Game.subs), `src/core/storage.ts` (migrate: `subs` absent → leave absent; readers treat absent as `[]`)

**Interfaces:**
- Produces:
  - `interface Sub { id: string; side: Side; ins: string[]; outs: string[]; order: number; period: number; enteredAt: string }`
  - `Game.subs?: Sub[]`
  - `interface Lineup { floor: string[]; bench: string[]; layout: string[]; outIds: string[]; justIn: string | null; suggestion: string | null; tracked: boolean; playedYet: boolean; changedUnseen: boolean }`
    - `floor`: on-floor player ids.
    - `bench`: everyone else on the roster, in roster order.
    - `layout`: every roster id in display order, frozen at the last sub (D11).
    - `tracked`: roster has more than 5 numbered players.
    - `playedYet`: this team has any play.
    - `changedUnseen`: the floor's count changed at a play, and this team has made no play since (drives amber, D8).
    - `justIn`: the last promoted player since the last sub.
    - `suggestion`: per D10.
  - `lineup(g: Game, side: Side): Lineup`
  - `isPromotingPlay(e: GameEvent, wasOut: boolean): boolean`: true for FG2, FG3, FTM, FTX or FOUL with a `playerId`, when the player was not out before the play.

Algorithm (the one part tests don't determine):
1. Starters are the first five ids of `rosterOf(g, side)`. A roster of 5 or fewer: all floor, `tracked = false`.
2. Merge this side's plays and its `subs`, sorted by `order`. On a tie, the sub comes first.
3. Walk them, keeping running fouls and techs per player:
   - a promoting play by a bench player adds her to the floor;
   - a play that takes her to 5 fouls or 2 techs removes her (`outIds`);
   - a sub removes `outs` that are on the floor and adds `ins` that are off it, skipping ids not on the roster or already out;
   - `layout` is rebuilt at each sub: floor in its current order, then bench in roster order.
4. `layout` before any sub: starters, then the rest in roster order. Promoted players keep their bench position until the next sub.

- [ ] **Step 1: Write failing unit tests in `lineup.test.ts`.** Use a 7-player Home roster (#4 #5 #7 #10 #12 #22 #31) and invented names.
  - **Starters:** floor = the first five; bench = #22, #31; `playedYet` false.
  - **Promotion:** a #22 FG2 makes the floor 6; `justIn` is the #22 id; `layout` is unchanged; `changedUnseen` is true, and false after another Home play.
  - **No promotion:** a TECH on #22; a play on an out player; a no-number play.
  - **Foul-out:** #10's 5th foul removes her from the floor, `outIds` includes her, and the floor is 4.
  - **Sub:** `{ins:[#22], outs:[#10]}` swaps them; `layout` is regrouped floor-first.
  - **Skipped parts:** a sub whose out is already off and whose in is already on changes nothing.
  - **Free-throw pair:** a #22 FTX then FTM promotes once.
  - **Review Focus 1:** a #22 FG2, then the sub `{ins:[], outs:[#4]}`, then the FG2's `playerId` changed to #31. Expected floor: #5, #7, #10, #12, #31 (#22 is not promoted; the out of #4 still applies).
  - **Small rosters:** roster ≤ 5 gives `tracked` false and everyone on the floor; an empty roster gives empty lists.
  - **Suggestion:** an out player first, else the player longest since her last play, ties to the earliest in `layout`.
  - **Growth past five (D2a):** a roster that grows from 3 to 6 mid-game. The first five are floor; the sixth is on the bench until she plays.
- [ ] **Step 2: Run `pnpm vitest run src/core/lineup.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement** the types and `lineup` as above.
- [ ] **Step 4: Run the test, then `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Lineup: the floor derived from plays and subs`.

### Task 2: Recording a sub

**Files:**
- Modify: `src/core/events.ts` (`slotOrders` takes `{order, period}[]`; new `recordSub`), `src/core/events.test.ts`

**Interfaces:**
- Consumes: `Sub`, `lineup` (Task 1).
- Produces:
  - `recordSub(g: Game, side: Side, ins: string[], outs: string[], now: Date): Game`. It appends a `Sub` whose `order` comes from `slotOrders([...g.events, ...(g.subs ?? [])], g.currentPeriod, 1)`. It returns `g` unchanged when `ins` and `outs` are both empty.
  - `slotOrders(others: { order: number; period: number }[], period: number, count: number): number[]`, the same behavior as today with a wider type.
  - `appendEvent` includes subs in `others`, so a play's order never collides with a sub's.

- [ ] **Step 1: Write the failing tests.**
  - `recordSub` gives a sub ordered after the last play.
  - A later `appendEvent` orders after the sub.
  - `editEvent` moving an earlier play to another quarter leaves the sub's order alone.
  - Empty `ins` and `outs` return the same game object.
- [ ] **Step 2: Run `pnpm vitest run src/core/events.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Subs: recorded among the plays' order`.

### Task 3: Lineup toasts

**Files:**
- Modify: `src/ui/live-logic.ts` (+ test), `src/ui/Live.tsx` (`record` / `labelFor`)

**Interfaces:**
- Consumes: `lineup` (Task 1).
- Produces:
  - `lineupSuffix(before: Lineup, after: Lineup, playerId: string | undefined): string`: `' · now on the floor'` when the player went from bench to floor, else `''`.
  - `foulOutLabel(whoNamed: string, reason: string): string`, giving `'#12 Name (Home) out, 5 fouls. Tell the official.'`. It replaces the foul toast's `— 5th, out` form. Keep `— bonus` appended when it applies.
  - `subLabel(g: Game, side: Side, ins: string[], outs: string[]): string`: `'#22 (Home) in for #10'` for one-for-one, `'Home floor updated'` otherwise.

- [ ] **Step 1: Write the failing unit tests** for the three functions, plus the free-throw pair (the second shot gives no suffix).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** In `Live.tsx`'s `record`, compute `lineup` before and after the new game inside the update and append the suffix. The foul-out toast uses `foulOutLabel`. Update every e2e and unit expectation of `foul — 5th, out` precisely.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Toasts: now on the floor, and tell the official on a foul-out`.

### Task 4: `TeamHalf` renders the lineup

**Files:**
- Modify: `src/ui/TeamHalf.tsx`, `src/ui/Live.tsx` (pass `lineup`), `e2e/fixture.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `Lineup` (Task 1).
- Produces:
  - `TeamHalf` takes `lineup: Lineup` and `onSub: () => void`.
  - It renders roster players in `lineup.layout` order: floor solid, bench ghosted with a gray `bench` tag in the dots row, out as today.
  - When `lineup.tracked` and the roster has 11 or more, the floor block stays fixed and the bench region scrolls (D11a).
  - A `Sub` button beside `+ Play` (≥ 44 px) shows:
    - `Starters` when `tracked && !playedYet`;
    - `Sub · N on` when the floor isn't 5;
    - otherwise `Sub`.
  - The button is amber (caution border and text, light/dark shades per the color table) when `changedUnseen`, else gray. There is no Sub button when `!tracked`.
- Fixture:
  - `floorOf(side): Promise<string[]>` reads the card numbers that are solid.
  - `subButton(side)`.

- [ ] **Step 1: Write the failing e2e tests.**
  - `the floor: first five solid, the rest ghosted with "bench"`.
  - `a bench player's +2 turns her card solid in place, and the Sub button reads "Sub · 6 on" in amber, then gray after that team's next play`.
  - `10 + 10 players fit each half with no scroll on iPhone 13`, keeping the 0.8 fit test.
  - `12 players: the floor stays in view while the bench scrolls` (Review Focus 4: the card order is unchanged after a promotion and after a foul-out).
  - `a bench card's contrast`: the `bench` tag text is ≥ 4.5:1 on both tones, and the ghost border ≥ 3:1. Reuse the 0.8 contrast helper.
- [ ] **Step 2: Run `pnpm test:e2e game`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep one border-color class per element (Tailwind resolves same-property utilities by stylesheet order). Measure and report the fit numbers.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS, with existing expectations updated precisely.
- [ ] **Step 5: Commit** with the message `Live: floor solid, bench ghosted, a Sub button per team`.

### Task 5: The sub sheet

**Files:**
- Create: `src/ui/SubSheet.tsx`
- Modify: `src/ui/Live.tsx`, `src/ui/EventSheet.tsx` (the sub row), `e2e/game.spec.ts`, `e2e/fixture.ts`

**Interfaces:**
- Consumes: `lineup`, `recordSub` (Tasks 1–2), `subLabel` (Task 3).
- Produces:
  - `SubSheet({ game, side, start, onRecord, onClose })`, where `start: { in?: string; out?: string } | null` is the player pre-moved from a play sheet.
  - Modes (D9):
    - floor > 5 → `Who went out?`, listing the floor with `just in` and `likely` tags; a tap removes, and the sheet closes at 5.
    - floor < 5 → `Who came in?`, listing the bench; a tap adds, and the sheet closes at 5.
    - floor = 5, or Starters → `Who's on the floor?`: toggles grouped `On the floor` / `On the bench`, a count `N on the floor` (green at 5), and `Done`, which never requires 5.
  - Out players are grayed with their reason and can't be put on.
  - It records exactly one `Sub` per completed sheet, with the net `ins` and `outs`. Cancel or the backdrop records nothing.
  - `EventSheet` gains an optional `subRow: { text: string; onSub: () => void }` rendered at the foot, separated from the plays (`#22 checks in` / `#10 comes out`).
- Fixture: `subIn(side, inName, outName)` and `setFloor(side, names[])`.

- [ ] **Step 1: Write the failing e2e tests.**
  - `deliberate sub: #22 checks in for #10 in 3 taps` (card, sub row, #10). The toast is `#22 (Home) in for #10`; the floor changes and the half regroups.
  - `forgotten sub: #22 scores from the bench, Sub · 6 on, "Who went out?" with #22 "just in" and a "likely" tag; one tap on the likely player closes it at 5`.
  - `line change at a quarter break: Who's on the floor?, 4 toggles each way, Done; toast "Home floor updated"`.
  - `foul-out: Sub · 4 on → "Who came in?" → #8 closes it`.
  - `Starters: before the first play the button reads Starters; changing two starters and Done sets the floor; ignoring it keeps the first five`.
  - `Undo after a sub restores the previous floor`.
  - `Cancel records nothing`.
  - `the other team's sub works the same` (Away).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** The sheet opened from a play sheet's row starts in the mode that row implies, with that player already moved.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Subs: the sub sheet and the play sheet's sub row`.

### Task 6: Demo mode

**Files:**
- Create: `src/ui/demo.ts` (+ test)
- Modify: `src/core/storage.ts` (keys take a prefix), `src/ui/store.ts`, `src/ui/Setup.tsx`, `src/ui/App.tsx` (marker), `src/ui/Live.tsx` (More → Reset demo), `package.json` (`"dev:demo": "astro dev --open /?demo"`), `e2e/demo.spec.ts`

**Interfaces:**
- Produces:
  - `isDemo(search: string): boolean`, true when the query string has `demo`.
  - `storageKeys(demo: boolean): { game: string; roster: string; prefs: string }`: `benchbook:` keys for real, `benchbook-demo:` for demo. Every storage read and write goes through the keys for the current mode.
  - `DEMO_SETUP: { team: string; opponent: string; ours: Player[]; theirs: Player[] }`: invented names, 8 players each.
  - `resetDemo(storage: Storage): void`.

- [ ] **Step 1: Write the failing tests.**
  - Unit: `isDemo('?demo')` is true and `isDemo('')` false; the demo keys differ from the real keys.
  - E2e `demo.spec.ts`: `?demo opens Setup with both demo rosters, shows the Demo marker on every screen, and never touches the real keys`.
    - Seed a real game in progress under the real keys first.
    - Start and play a demo game.
    - Assert the real keys are byte-identical afterward.
    - Open `/` with no `?demo` and see the real game (Review Focus 5).
  - E2e: `Reset demo clears the demo game and refills the rosters`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** The marker is a small gray label in a fixed corner that doesn't cover controls.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS. Run `pnpm dev:demo` once and confirm it opens `/?demo`.
- [ ] **Step 5: Commit** with the message `Demo mode: ?demo with its own storage`.

### Task 7: Scripted games, How-to, audit scenario, changelog

**Files:**
- Modify:
  - `e2e/both-teams.spec.ts`, `e2e/full-game.spec.ts`, `e2e/bonus-game.spec.ts` (only if lineup changes break them)
  - `scripts/howto/shots.spec.ts`, `src/ui/howto-content.ts` (+ test)
  - `docs/ux-audit/scenario.md`, `CHANGELOG.md`
  - `README.md` (How a game works; Backlog: tick the lineup item; add "Tick starters in Setup" to the backlog)
  - `CLAUDE.md` (1.0 checklist: tick the lineup item, "(0.9)")

- [ ] **Step 1: Add lineup steps to the both-teams game.** A deliberate sub, a forgotten sub resolved through "likely", a foul-out filled through "Who came in?", and a line change at halftime. Keep its numbers unchanged, since subs change no count.
- [ ] **Step 2: Update the How-to** (a "Subs" section: floor and bench, the Sub button, Starters, the sheet's three questions), and add a lineup screenshot to the shots spec if it fits under the 1 MB guard.
- [ ] **Step 3: Update the audit scenario's Events** with a routine sub, a quarter-break line change, a forgotten sub, and a foul-out replacement. Use in-world wording only ("#22 checks in at the table for #10"). The expected end state is unchanged apart from any new plays. Verify the extraction with `awk '/^## Events$/{f=1; next} /^## /{f=0} f' docs/ux-audit/scenario.md | grep -c '^[0-9]\+\.'`.
- [ ] **Step 4: Update the CHANGELOG, README and CLAUDE.md** as listed. Then run `pnpm check && pnpm test:e2e && pnpm howto:shots`.
- [ ] **Step 5: Commit** with the message `Docs and scripted games for the active lineup`.

### Task 8: Release 0.9.0

- [ ] **Step 1: Run `git fetch`.** If `master..origin/master` is non-empty, merge and re-run the gate.
- [ ] **Step 2: Run `pnpm release minor`.** Expected: `Released v0.9.0.`
- [ ] **Step 3: Push** only with the owner's go-ahead: `git push && git push --tags`.
