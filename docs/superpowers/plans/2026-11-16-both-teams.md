# Both Teams on the Live Screen (0.8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the other team play by play by jersey number, on a Home vs Away live screen, in one mode, with both teams in the exports and the quarter check.

**Architecture:** Events gain an optional `side: 'them'` (absent = ours), and the game gains `oppRoster`, so every saved game keeps its meaning. `derive` computes the same per-team numbers for both sides. The live screen is two `TeamHalf` components (Home left and light, Away right and dark), and each owns its cards, a half-height Bench card and its timeout buttons.

**Tech Stack:** Astro 5 + Preact, Tailwind 4, Vitest (unit), Playwright as iPhone 13 (e2e), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-16-both-teams-design.md`. Read it first; decisions are numbered 1–10 there and cited as D1–D10 below.

## Global Constraints

- US English in all copy, comments and commits; no Claude/Anthropic trailer on commits (`CLAUDE.md`).
- Test data uses invented names only (the repo is public).
- Colors follow `README.md` § Colors: amber = caution, red = out/ends, blue (`sky`) = the action to take, white fill = a screen's main button, green = done, gray = the rest. The US tag is **not** blue.
- Light (home) cards keep the color jobs with darker shades: text ≥ 4.5:1 and borders/dots ≥ 3:1 against the card.
- Timeout totals per team: Full 3, 30s 2, OT 1 per OT period (unchanged, `TimeoutState`).
- `MAX_PLAYERS = 15` per roster. 10 players + Bench fit a half; 11–15 scroll inside the half.
- Copy fixed by the spec: timeout buttons `Full: n`, `30s: n`, `OT: n`. Zero warning `<Side> has no <full|30-second|OT> timeouts left. Are you sure?` with button `Take one anyway`. Bonus badge `Home shoots` / `Away shoots`. Check warning `Their score: book <b> · app <a> — <n> off`, agreeing form `Their score: book <b> · app <a> ✓`.
- The gate before every commit: `pnpm check`. Any change to `src/ui/` or `e2e/` also runs `pnpm test:e2e`.
- A game saved before 0.8 must load and keep its numbers. Its `OPP_PTS` events still count toward their score.

## Review Focus

1. **Any code that reads events by type counts the other team's plays as ours unless it checks the side.** Today that's `derive.ts`, `running.ts`, `export-plays.ts`, `log-logic.ts` and `Log.tsx`. Expected: the running score, our player lines, our team fouls and our timeouts ignore `side: 'them'`. Pinned in Tasks 2 and 3.
2. **A play for the other team with no number** (`side: 'them'`, no `playerId`). Expected: it counts toward their score and team fouls, never toward any player line, and it shows as "Away +2" in the Log and toast. Pinned in Tasks 2 and 9.
3. **A game saved before 0.8 that is in progress** (`trackOpponentTaps: true`, `OPP_PTS` events, no `oppRoster`). Expected: it loads, their score includes the old taps, and their half shows only Bench and timeouts. Pinned in Task 1.
4. **The same jersey number on both teams** (#4 Home and #4 Away). Expected: each toast, Log row and fix sheet says which team; fixing one never touches the other. Pinned in Tasks 8 and 9.
5. **The light (home) card's warn and out states.** Expected: still readable on white (OUT text ≥ 4.5:1). Pinned in Task 7.

---

### Task 1: Data shape, migration, and roster helpers

**Files:**
- Modify: `src/core/types.ts`, `src/core/events.ts`, `src/core/storage.ts`, `src/ui/roster.ts`
- Test: `src/core/events.test.ts`, `src/core/storage.test.ts`, `src/ui/roster.test.ts`

**Interfaces:**
- Produces:
  - `type Side = 'us' | 'them'`
  - `GameEvent.side?: 'them'` (absent means ours)
  - `Game.oppRoster: Player[]`
  - `sideOf(e: GameEvent): Side` (in `events.ts`)
  - `rosterOf(g: Game, side: Side): Player[]`
  - `newGame(info, roster, now, oppRoster: Player[] = [])`, with `now` kept in third place so existing callers compile
  - `addPlayer(g: Game, side: Side, p: Player, now: Date): Game`
  - `validateOppRoster(players: Player[]): string[]`: like `validateRoster`, but an empty list is valid, and blank rows are dropped first by `cleanOppRoster(players: Player[]): Player[]`
  - `homeSide(g: Game): Side`: `'us'` when `info.homeAway === 'home'`, else `'them'`
  - `sideName(g: Game, side: Side): 'Home' | 'Away'`

- [ ] **Step 1: Write the failing tests.**
  - `sideOf({…, side: undefined}) === 'us'`, and `sideOf({…, side: 'them'}) === 'them'`.
  - `migrateGame` on a stored game with no `oppRoster` returns `oppRoster: []` and leaves events untouched. Use an `OPP_PTS` event in the fixture.
  - `addPlayer(g, 'them', {id:'x', number:'14', name:'', pos:''}, now).oppRoster` ends with #14, and `roster` is unchanged.
  - `validateOppRoster([])` is `[]`. A row with a name and no number gives `'Every player needs a jersey number.'`. A duplicate `#4` is reported as it is for ours.
  - `sideName` gives Home for us on a home game and Away for them on a home game.
- [ ] **Step 2: Run `pnpm vitest run src/core/events.test.ts src/core/storage.test.ts src/ui/roster.test.ts`.** Expected: FAIL (the new functions don't exist yet).
- [ ] **Step 3: Implement the interfaces above.** `migrateGame` gains a `migrateOppRoster` step. `addPlayer` throws on a duplicate number for that side.
- [ ] **Step 4: Run the same tests, then `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Both teams: side on events, opponent roster, migration`.

### Task 2: `derive` per team

**Files:**
- Modify: `src/core/derive.ts`, `src/core/running.ts`
- Test: `src/core/derive.test.ts`, `src/core/running.test.ts`

**Interfaces:**
- Consumes: `sideOf`, `Game.oppRoster` (Task 1).
- Produces:
  - `interface TeamDerived { players: PlayerLine[]; byPeriod: Record<number, number>; total: number; teamFoulsByPeriod: Record<number, number>; teamFoulsForBonus(period: number): number; benchTechs: number; timeouts: TimeoutState }`
  - `Derived.us: TeamDerived` and `Derived.opp: TeamDerived`. `opp` is built from `side: 'them'` events; `opp.byPeriod` and `opp.total` also add legacy `OPP_PTS`. `TeamHalf` (Task 6) takes either one.
  - The existing top-level fields stay and mean **ours only**: `usByPeriod`, `usTotal`, `players`, `teamFoulsByPeriod`, `teamFoulsForBonus`, `benchTechs`, `timeouts`.
  - `oppByPeriod` and `oppTotal` stay as aliases of `opp.byPeriod` and `opp.total`, so `reconcile.ts` keeps working unchanged.
  - `oppInBonus(period)` is unchanged: our fouls ≥ 5. New `usInBonus(period)`: their fouls ≥ 5.

- [ ] **Step 1: Write the failing tests.** Use a game whose roster has #4 and whose `oppRoster` has #4 and #14.
  - Their `FG2` on #14 gives `opp.total === 2`, `opp.players[1].points === 2`, `usTotal === 0`, and `players[0].points === 0`.
  - A `FOUL` on their #4 bumps `opp.teamFoulsByPeriod[1]`, not `teamFoulsByPeriod[1]`. Our #4's fouls stay 0.
  - A no-number `FOUL` with `side: 'them'` counts toward `opp.teamFoulsByPeriod`, and no `opp.players` line changes.
  - A `TIMEOUT` with `side: 'them'` and `timeoutKind: 'full'` gives `opp.timeouts.full.used === 1` and `timeouts.full.used === 0`.
  - Five of their fouls in Q2 make `usInBonus(2)` true and `oppInBonus(2)` false.
  - A legacy `OPP_PTS` of 3 plus their `FG2` gives `oppTotal === 5`.
  - `runningScore` ignores `side: 'them'` plays: one ours `FG2` and one theirs gives one mark, scoring 2.
- [ ] **Step 2: Run `pnpm vitest run src/core/derive.test.ts src/core/running.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Factor the existing loop into `deriveTeam(g, side, roster): TeamDerived`, then call it twice. Fold `OPP_PTS` into the `them` totals. `runningScore` skips `sideOf(e) === 'them'`.
- [ ] **Step 4: Run the tests, then `pnpm check`.** Expected: PASS, and the existing derive tests unchanged.
- [ ] **Step 5: Commit** with the message `derive: the same numbers for both teams`.

### Task 3: Exports

**Files:**
- Modify: `src/core/derive.ts` (the two predicates below live here, beside `derive`), `src/core/export-book.ts`, `src/core/export-plays.ts`
- Test: `src/core/export.test.ts`, `src/core/derive.test.ts` (the predicates)

**Interfaces:**
- Consumes: `Derived.opp`, `rosterOf`, `sideName`, `sideOf`.
- Produces:
  - `hasOppRecord(g: Game): boolean`: true when there's any `side: 'them'` event, any `OPP_PTS`, or a non-empty `oppRoster`.
  - `oppPointsRecorded(g: Game): boolean`: true when there's any `OPP_PTS`, or any `side: 'them'` event of type FG2/FG3/FTM/FTX.

- [ ] **Step 1: Write the failing tests.**
  - A game with nothing recorded for them gives a `bookCsv` **byte-identical** to the current output. Keep a fixture string from today's code in the test.
  - With their #14 scoring a FG2, the Book CSV has, after our block, a row `['<opponent> (Away)']`, then the same player-table header and their #14 row (`'#14'`, 2 points), their team-fouls rows, `Bench technicals`, and the three `Timeouts used` rows.
  - The opponent's running score is blank, not `0*`, when `oppPointsRecorded` is false, whatever `trackOpponentTaps` says.
  - `playsCsv`'s header gains a last column, `side`. A their-side FG2 row has `team` `opp`, `number` `14`, `event` `FG2` and `side` `away` on a home game. Our rows say `home`. A legacy `OPP_PTS` row has `team` `opp` and an empty `number` and `player`.
- [ ] **Step 2: Run `pnpm vitest run src/core/export.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Book CSV: append their block only when `hasOppRecord`, and key the opponent blank-versus-estimate rule on `oppPointsRecorded`. Plays CSV: their points add to `opp_score`, and the player comes from `rosterOf(g, sideOf(e))`.
- [ ] **Step 4: Run the tests, then `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Exports: the other team's block and a side column`.

### Task 4: Live-screen copy and logic helpers

**Files:**
- Modify: `src/ui/live-logic.ts`
- Test: `src/ui/live-logic.test.ts`

**Interfaces:**
- Produces:
  - `bonusText(shooter: 'Home' | 'Away'): string`, which returns `` `${shooter} shoots` ``. It replaces `BONUS_TEXT`.
  - `timeoutButtonText(kind: TimeoutKind, left: number): string`, giving `'Full: 2'`, `'30s: 0'` or `'OT: 1'`. The display floors at 0.
  - `timeoutsLeft(t: TimeoutState, kind: TimeoutKind): number`, which is `total - used`.
  - `zeroTimeoutWarning(side: 'Home' | 'Away', kind: TimeoutKind): string`, giving `'Away has no full timeouts left. Are you sure?'`. The kind words are `full`, `30-second` and `OT`.
  - `TAKE_ANYWAY = 'Take one anyway'`.
  - **Every play names its team, ours included** (owner, 2026-11-16): the screen is Home vs Away and "us" is only a marker.
  - `who(p: Player | null, tag: 'Home' | 'Away'): string`: `'#4 (Home)'`, `'#14 (Away)'`, and with no player `'Away'`.
  - `playLabel(type, number)` becomes `playLabel(type: PlayType, whoText: string)`, so the toast reads `'#4 (Home) +2'`. `foulLabel`'s context gains `tag: 'Home' | 'Away'`, so a foul-out reads `'#24 (Away) foul — 5th, out'`, and `— bonus` applies to the fouling team's count.
  - A bench tech reads `'Home bench tech'`, and a timeout `'Away timeout (Full)'` (`timeoutLabel(kind, tag)`).

- [ ] **Step 1: Write the failing tests**, one per function above. Copy the exact strings from Global Constraints and the bullets above. Update the existing `playLabel`, `foulLabel` and `timeoutLabel` cases to the tagged wording (`'#4 (Home) +2'`, `'Home timeout (Full)'`).
- [ ] **Step 2: Run `pnpm vitest run src/ui/live-logic.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Update the callers, so `pnpm check` compiles (`Live.tsx`, `log-logic.ts`).
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS. The e2e toast and Log assertions change to the tagged wording here. Most go through the fixture's `playText`, which becomes `` `#${n} ${name} (${side}) · ${play}` ``; the rest is a search for `toHaveText('#` and `'Bench tech'` in `e2e/` and `scripts/howto/`.
- [ ] **Step 5: Commit** with the message `Live copy for two teams: who, bonus, timeout buttons`.

### Task 5: Setup — the other team's roster

**Files:**
- Create: `src/ui/RosterEditor.tsx` (extracted from `Setup.tsx`'s roster section: rows, Add player, remove)
- Modify: `src/ui/Setup.tsx`
- Test: `e2e/game.spec.ts` (setup tests), `e2e/fixture.ts`

**Interfaces:**
- Consumes: `validateOppRoster`, `cleanOppRoster`, `newGame(info, roster, now, oppRoster)` (Task 1).
- Produces: `RosterEditor({ label, players, onChange, idPrefix }: { label: string; players: Player[]; onChange: (p: Player[]) => void; idPrefix: string })`. Field labels are `` `${idPrefix} ${n} number` `` and `` `${idPrefix} ${n} name` ``. Ours keeps the prefix `Player`, so the existing tests still find their fields. Theirs is `Their player`.
- Fixture: `fillOppRoster(players: {number: string; name?: string}[])`.

- [ ] **Step 1: Write the failing e2e test**: `setup: the other team's roster is optional, numbered, and starts the game with it`.
  - Starting with no rows succeeds.
  - A row with a name and no number blocks Start with `Every player needs a jersey number.`.
  - With #14 and #24 entered, Start succeeds. (Their cards on the live screen are asserted in Task 6.)
  - Discard that game and open New game again: their roster is **empty** (it isn't saved), and ours is prefilled as today.
- [ ] **Step 2: Run `pnpm test:e2e game`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The roster section **"Their roster (optional)"** sits under ours, with one blank row and a count `(n/15)`.
  - The "Also keep their score" checkbox and its pref are removed. Leave `loadPrefs`/`savePrefs` in storage, unused, and delete only their UI use. `newGame` is called with the cleaned other-team roster.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS. `fillSetup` in the fixture drops its checkbox line.
- [ ] **Step 5: Commit** with the message `Setup: the other team's roster`.

### Task 6: `TeamHalf`, the strip, and the live layout

**Files:**
- Create: `src/ui/TeamHalf.tsx` (replaces `PlayerGrid.tsx`; delete that file)
- Modify: `src/ui/Live.tsx`, `src/ui/StatusStrip.tsx`
- Test: `e2e/game.spec.ts`, `e2e/fixture.ts`

**Interfaces:**
- Consumes: `TeamDerived`, `homeSide`, `sideName`, `rosterOf`, and every helper from Task 4.
- Produces: `TeamHalf({ side, tone, isUs, roster, team, onPick, onBench, onTimeout, period })`, where:
  - `tone: 'light' | 'dark'` (home is light);
  - `team: TeamDerived`;
  - `onPick(p: Player)`, `onBench()`, `onTimeout(kind: TimeoutKind)`.
- Fixture: `card(name)` scopes to `getByRole('region', { name: 'Home' | 'Away' })`. Add `half(side: 'Home' | 'Away')`. `timeout(kind, side = <our side>)` taps the half's button.

- [ ] **Step 1: Write the failing e2e tests.**
  - `both halves: Home left and light, Away right and dark, US tag on our side`:
    - on a home game, the `region` Home's box x is less than Away's;
    - Home's card background is light, `rgb` lightness > 0.8 via `getComputedStyle`;
    - `getByText('US', {exact: true})` sits inside Home;
    - on an away game the tag moves to Away and the sides don't swap.
  - `10 players and the Bench card fit each half with no scroll`, on the iPhone 13 profile:
    - the half's `scrollHeight <= clientHeight`;
    - the Bench card is about half a player card's height: its height < 0.6 × a card's.
  - `11+ players scroll inside their half`: with 12 in our roster, our half scrolls and the other half doesn't.
  - `the strip`: the score shows home–away, each half's header shows its team fouls, and the bonus badge reads `Home shoots` over Home when Away has 5 fouls.
- [ ] **Step 2: Run `pnpm test:e2e game`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The live screen is `<StatusStrip/>`, a two-column grid of `TeamHalf` (Home, then Away), `FeedbackLine`, and a 4-button bar (Undo, Log, End, ⋯). The Opp row and the Timeout bar button are removed.
  - Each half is a `role="region"` with `aria-label` `Home` or `Away`.
  - Cards are two columns, number, points and foul dots, name truncated. Out cards keep the full-strength OUT, red dots and red border (as in 0.6.0).
  - The Bench card is half height. Under it go the timeout buttons, `timeoutButtonText` per kind (OT only when `isOvertime(period)`), styled as raised buttons. A zero count draws grayed but stays tappable.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: the new tests PASS. Existing tests that used the bar Timeout or the strip's `TO left` go through the fixture changes above. Update `expectBarOneRow` to the 4 buttons, and `timeoutsText` checks become per-half button texts.
- [ ] **Step 5: Commit** with the message `Live: Home vs Away halves, per-team timeouts`.

### Task 7: Light-card colors and contrast

**Files:**
- Modify: `src/ui/TeamHalf.tsx`, `README.md` (Colors table: a "Light (home) cards" row giving the shades used)
- Test: `e2e/fixture.ts` (helper), `e2e/game.spec.ts`

**Interfaces:**
- Produces: the fixture helper `contrast(locator): Promise<number>`, the WCAG ratio of its text color against the nearest opaque background. Colors are converted through a canvas, because Tailwind 4 emits `oklch()`.

- [ ] **Step 1: Write the failing e2e test**: `light cards: warn and OUT stay readable`. On a home game, give our player 4 fouls and then a 5th:
  - the OUT text contrast is ≥ 4.5;
  - the warn border and the dots are ≥ 3 against the card. Use `contrast` on a 1-px probe, or compute from `borderColor`.
  - Repeat the OUT check on a dark card.
- [ ] **Step 2: Run it.** Expected: FAIL if the dark-card shades are reused on white.
- [ ] **Step 3: Implement** the light shades (amber-600/700 and red-600/700 on white, slate-900 text) and the README row.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Light cards: readable warn and out states`.

### Task 8: Live sheets — their plays, Bench, Add a player, the zero-timeout guard

**Files:**
- Modify: `src/ui/Live.tsx`, `src/ui/EventSheet.tsx`
- Test: `e2e/game.spec.ts`, `e2e/fixture.ts`

**Interfaces:**
- Consumes: `addPlayer`, the `who`/`playLabel`/`foulLabel`/`timeoutLabel` from Task 4, `zeroTimeoutWarning`, `TAKE_ANYWAY`, `outReason`.
- Produces, in the fixture:
  - `theirPlay(number: string | null, play)`: `null` uses the no-number plays on their Bench sheet;
  - `opp(n: 1 | 2 | 3)`: kept for the old scripts, mapped to a no-number `FT made`, `+2` or `+3`;
  - `addPlayer(side, number, name?)`;
  - `expectZeroGuard(side, kind)`.

- [ ] **Step 1: Write the failing e2e tests.**
  - `their play: tap their #14, +2 — Away's score and #14's card go up; the toast reads "#14 (Away) +2"`.
  - `their bench sheet: no-number +2 counts to their score, a no-number Foul to their team fouls only`.
  - `their foul-out: 5 fouls on their #24 — the card shows OUT and the sheet opens with the out warning`.
  - `Add a player from either Bench sheet: their #33 appears as a card and takes a play`. Then adding #33 again shows `Duplicate number: #33.` and adds nothing.
  - `a timeout at zero is guarded`. After their 3 Full timeouts:
    - the button reads `Full: 0` and draws grayed;
    - a tap opens the warning `Away has no full timeouts left. Are you sure?`;
    - **Take one anyway** records it (the Log has 4 Away full timeouts);
    - Cancel records nothing.
  - `same number on both teams`: our #4 and their #4 each take a +2; each card shows 2, and the two toasts differ (`#4 (Home) +2` and `#4 (Away) +2`).
- [ ] **Step 2: Run `pnpm test:e2e game`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `picked` carries its `side`. `play()` adds `side: 'them'` for theirs, and the sheet title uses `who`.
  - The Bench sheet is per side:
    - `Bench tech`;
    - `Add a player`, which opens a number and name form validated like Setup;
    - for their side only, the six no-number plays.
  - A timeout tap: if `timeoutsLeft` > 0, add it. Otherwise open the guard sheet, where `TAKE_ANYWAY` adds it.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Live: their plays, bench sheet, add a player, timeout guard`.

### Task 9: Log and the fix sheet

**Files:**
- Modify: `src/ui/log-logic.ts`, `src/ui/Log.tsx`, `src/core/events.ts` (the `editEvent` patch accepts `side`)
- Test: `src/ui/log-logic.test.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `who`, `sideOf`, `rosterOf`, `sideName`.
- Produces:
  - `EditDraft` and `EditPatch` gain `side?: 'them'`.
  - `editPatch` clears `playerId` when the side changes and the chosen player isn't on the new side.
  - `eventLabel(g, e)` names the team for every event: `'#4 Player One (Home) · +2'`, `'#14 (Away) · +2'` (no name), `'Away · +2'` (no number), `'Home bench tech'` (Review Focus 2 and 4).

- [ ] **Step 1: Write the failing tests.**
  - Unit: `eventLabel` for our FG2 on #4 Player One is `'#4 Player One (Home) · +2'` on a home game. A their-side FG2 on #14 with no name is `'#14 (Away) · +2'`, and a no-number one is `'Away · +2'`. A legacy `OPP_PTS` keeps today's text.
  - Unit: `editPatch` from their #14 to our side with our #4 gives `{ side: undefined, playerId: '<our #4 id>' }`.
  - E2e: `fix sheet: a play entered on the wrong team moves to the other team`.
    - Enter a +2 on their #4 that was ours.
    - In Log, tap it, then pick **Home** under Team and #4 under Player, then Save.
    - Home's score goes up by 2, Away's down by 2, and the row reads `#4 Player One (Home) · +2`.
- [ ] **Step 2: Run** `pnpm vitest run src/ui/log-logic.test.ts && pnpm test:e2e game`. Expected: FAIL.
- [ ] **Step 3: Implement.** The fix sheet gets a `Team` group (Home and Away buttons) above `Player`. The Player group lists the chosen side's roster, plus `No number` for their side.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Log: which team, and moving a play between teams`.

### Task 10: The quarter check — their score warning and both teams' fouls

**Files:**
- Modify: `src/ui/reconcile-logic.ts`, `src/ui/Reconcile.tsx`
- Test: `src/ui/reconcile-logic.test.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `checkPeriod` (unchanged; `oppTapped` now includes numbered plays via Task 2), `Derived.opp`, `hasOppRecord`.
- Produces: `theirScoreLine(c: PeriodCheck): { text: string; warn: boolean } | null`. It's `null` when `bookOppTotal === null`.

- [ ] **Step 1: Write the failing tests.**
  - Unit: book 22 against app 20 gives `{ text: 'Their score: book 22 · app 20 — 2 off', warn: true }`.
  - Unit: book 20 against app 20 gives `{ text: 'Their score: book 20 · app 20 ✓', warn: false }`.
  - Unit: a blank box gives `null`.
  - Unit: the period's **status** is still `matched` when ours matches and theirs is off.
  - E2e: `check: their score off warns but the quarter still saves as matched`.
    - The amber line shows.
    - After Save, the Log chip reads `✓ Matched`, and the Final screen has no open issue for that quarter.
  - E2e: when the other team has plays, the check shows `Team fouls in Q2` for both teams, and `Player fouls, whole game` lists both rosters under team headings.
- [ ] **Step 2: Run** `pnpm vitest run src/ui/reconcile-logic.test.ts && pnpm test:e2e game`. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace the `Opponent: book · taps` line with `theirScoreLine`, amber when `warn`. Show both teams' fouls when `hasOppRecord(game)`.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Check: their score warns, both teams' fouls`.

### Task 11: Update the scripted games, and add the both-teams game

**Files:**
- Modify: `e2e/full-game.spec.ts`, `e2e/bonus-game.spec.ts`, `scripts/howto/shots.spec.ts`
- Create: `e2e/both-teams.spec.ts`
- Test: those files

**Interfaces:**
- Consumes: the fixture helpers from Tasks 5–10.

- [ ] **Step 1: Update full-game and bonus-game.** Same games, same expected numbers.
  - Opp taps go through `opp(n)`, which is now no-number plays.
  - Timeouts go through `timeout(kind)` on our half.
  - Their Plays CSV opponent rows now read `event` `FG2`, `FG3` or `FTM` with `team` `opp`, where they used to read `OPP_PTS`. Update `['us 0 FG2', 'opp  OPP_PTS']` to `['us 0 FG2', 'opp  FG2']`, and any CSV column assertions for the new `side` column.
- [ ] **Step 2: Write `both-teams.spec.ts`**: `both teams: a game by number with a halftime fix, a foul-out, a timeout at zero and an added player`. Script it as a table, like full-game:
  - Q1–Q2: plays for both teams by number, with the same number on both teams once.
  - Their #24 fouls out in Q2.
  - Their 3 Full timeouts, then a 4th taken anyway.
  - Halftime check, with the book at their score **and** ours, and two fixes:
    - a FT logged as `FT missed` that was made, which **changes the score**: the check shows the app 1 short, and the fix is a type change in the fix sheet;
    - a foul that was never logged, which does **not** change the score: the check's `Team fouls in Q2` reads one short of the book. Add it with `Add play to Q2` → Foul.
  - Q3–Q4: a few plays; their late #33 is added from their Bench sheet and scores.
  - End the game. Assert:
    - both CSVs: their block, their #24's 5 fouls, timeouts `4 of 3`, and every `side` value;
    - the Final score rows.
- [ ] **Step 3: Run `pnpm test:e2e`.** Expected: PASS (all specs).
- [ ] **Step 4: Run `pnpm howto:shots`.** Check the three images by eye, at `public/howto/*.png`.
- [ ] **Step 5: Commit** with the message `e2e: scripted games on the new screen, and a both-teams game`.

### Task 12: Docs — How-to, the audit scenario, changelog

**Files:**
- Modify:
  - `src/ui/howto-content.ts`, `src/ui/howto-content.test.ts`
  - `docs/ux-audit/scenario.md` (both `## Events` and `## Expected end state`)
  - `CHANGELOG.md`
  - `README.md` (`## How a game works` and Backlog: mark the opponent stats item done; add **"Read a roster from a photo of the book (OCR): much later"**)
- Test: `src/ui/howto-content.test.ts`

- [ ] **Step 1: Update the How-to.** Before tip-off: their roster, optional. Live: Home left and light, Away right and dark; tap any player; timeouts under each Bench card; Bench sheet for no-number plays and Add a player. Remove every mention of Opp +1/+2/+3, "Also keep their score", and the bar Timeout button. Update the tests that pin those words.
- [ ] **Step 2: Rewrite the audit scenario for both teams.**
  - The events give their roster at event 1.
  - Their plays name a number.
  - Halftime has the **two fixes** from D10 (a made FT logged as missed, and a missed foul).
  - The expected end state covers both teams.
  - Don't run the audit; it runs in a fresh session.
- [ ] **Step 3: Write the changelog bullets**, one per user-visible change, in US English.
- [ ] **Step 4: Run `pnpm check && pnpm test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `Docs: How-to, audit scenario and changelog for both teams`.

### Task 13: Release 0.8.0

- [ ] **Step 1: Run `git fetch` and check `master..origin/master`.** Merge if it moved, and re-run `pnpm check && pnpm test:e2e` after.
- [ ] **Step 2: Run `pnpm release minor`.** Expected: `Released v0.8.0.` (it runs the gate, the e2e suite and the How-to shots).
- [ ] **Step 3: Push** only with the owner's go-ahead: `git push && git push --tags`.
