# 1.1 One-Tap Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live screen's two-column player cards with one full-width row per player, carrying one-tap **+2** and **Foul** buttons, in a scrolling list per half, released as 1.1.0.

**Architecture:** The pure rules (guards, labels, timings, the first-use tip) go in `src/ui/live-logic.ts` with unit tests. `TeamHalf.tsx` draws the rows and the scrolling list and owns the display-only effects (flash, scroll-to-top, swap guard). `Live.tsx` gains one `quick(side, p, type)` handler that calls the existing `record()` (no second recording path). The lineup (`src/core/lineup.ts`) does not change.

**Tech Stack:** Astro, Preact, Tailwind 4, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-24-one-tap-rows-design.md` (read it whole; "Settled after the builder check" holds rulings). Look reference only, never merge: the spike diff at `/tmp/claude-1000/-home-jon-Dev-bench-book/96c04aa9-0126-4dc7-870b-f3ebe26cb221/scratchpad/spike-tall.diff`.

## Global Constraints

- Rows 56 px tall (`h-14`), 8 px apart (`gap-2`); +2 and Foul buttons 56 × 52 px (`w-14 h-[52px]`), 12 px apart (`ml-3`); an extra 8 px gap after the top block (`layoutFloor` rows); no extra gap when there is no rest section.
- No names on rows. Jersey number 28 px bold; points smaller, gray (`name` tone), set apart so "#3 0" never reads "30".
- +2 filled (Home `bg-slate-200 border-slate-500`, Away `bg-slate-600 border-slate-400`); Foul is the word "Foul", outline (transparent fill, same border).
- Foul trouble: at 4 fouls an inset 2 px amber ring (amber-600 light, amber-700 on a light rest row, amber-400 dark) and amber dots. Out: red ring, the word OUT at 12 px in place of the dots, number area grayed, +2/Foul dashed with readable labels.
- Flash changes the **fill only**, never the ring: sky-100 light, sky-900 dark; 400 ms on a row tap, 1000 ms on a swapped row.
- `SETTLE_MS = 2000`. The settle wait restarts on any pointerdown and any scroll.
- After a swap the half scrolls its list to the top unless the list was scrolled by hand in the last 5000 ms; `prefers-reduced-motion: reduce` jumps instead of animating.
- Swap guard: 500 ms after an activity swap shows, that half's row +2/Foul taps are ignored; the number area always works; other half unaffected. A sub (settleKey change) does not start it.
- Double tap: the same side + player + play within 400 ms records once.
- Out row's +2/Foul never record: they open the player's popup (with its existing out warning).
- A guarded/ignored tap still counts as a tap (it is a button click; do nothing to stop the `App.tsx` listener).
- Labels: +2 `"Home #23, 2 points"`, Foul `"Home #23, foul"`; number area `"#23, 12 points, 3 fouls, more plays"` (`", out"` before `", more plays"` when out); row group `"Home #23, on floor"` or `"Home #23, bench"`. Side words come from `sideName` (Home/Away), never the typed team name.
- Swap announcement names only the players who moved INTO the top block: `"#32 moved up"`, or `"#32 and #10 moved up"` when two did.
- Controls: +Play, Sub and the bench-tech button share one row; the bench-tech button's visible text is `Tech`, its accessible name stays `Bench / coach tech` (with `, N techs` as today). Timeout buttons 44 px (`min-h-11`).
- A 16 px fade (`h-4`) at the list's bottom, `pointer-events-none`, gradient to the half's background. No "N more" counter.
- First-use tip text, verbatim: `Tap a number for 3s, free throws and fixes.` Shown once per device (pref flag `rowTipShown`).
- Colors follow `docs/colors.md`; blue gains a second job: "a row just recorded or moved". Contrast checked by hand, recorded in `docs/colors.md`.
- US English, gender-neutral prose, invented test names only. Commit to master; no Claude/Anthropic trailer. Never push. Any weakened, replaced or deleted test assertion is named in the commit message.

## Rulings made in this plan (beyond the spec)

- **Swap announcement goes in a visually hidden `role="status"` region inside each half**, not the visible feedback line: the feedback line's entry is what Undo undoes (`aria-describedby`), and overwriting it with "#32 moved up" would make Undo's description wrong.
- **"A swap" = any order change that showed after the settle wait** (not via `settleKey`). An Undo of a promoting play also reverts the order after the wait and so also starts the 500 ms guard and the scroll; telling the two apart would need the store to tag the cause. Cost if wrong: an ignored row tap within 500 ms of an undo's reorder.
- **The tip** is the feedback line's entry while there is no toast; the flag is saved on the first Live mount that shows it, so it never shows on a second game.

## Review Focus

1. **Undo right after a one-tap play** restores the score and toast exactly as a popup play's Undo does. Test: Task 3, `row +2 then Undo leaves the game as before`.
2. **Two-digit numbers with two-digit points** (`#30` with 12 points beside `#3` with 0) stay readable as separate figures. Check: Task 2 step 6 screenshot, looked at, not asserted.
3. **A half with no roster** (opponent tracked by + Play only) shows no rows, and + Play / Tech / timeouts stay at the half's foot. Test: Task 3, invariant 6 test asserts it for the empty Away half.
4. **A scorer who scrolled down to tap #15** and then taps again before 5 s does not get yanked to the top. Test: Task 3, `hand scroll holds the list for 5 s`.
5. **Free throws from the number area** still keep the sheet open for the pair (unchanged flow). Covered by the existing `app.ft()` callers once the fixture finds the number area; no new test.

---

### Task 1: Pure rules and the tip pref

**Files:**
- Modify: `src/ui/live-logic.ts` (SETTLE_MS and new exports at the end)
- Modify: `src/core/storage.ts:134-154` (Prefs)
- Test: `src/ui/live-logic.test.ts`, `src/core/storage.test.ts`

**Interfaces:**
- Produces (all in `live-logic.ts`):
  - `SETTLE_MS = 2000`
  - `DOUBLE_TAP_MS = 400`, `SWAP_GUARD_MS = 500`, `HAND_SCROLL_HOLD_MS = 5000`, `FLASH_TAP_MS = 400`, `FLASH_SWAP_MS = 1000`
  - `type QuickPlay = 'FG2' | 'FOUL'`
  - `type QuickTap = { key: string; at: number }`
  - `quickKey(side: Side, playerId: string, type: QuickPlay): string`
  - `isDoubleTap(last: QuickTap | null, key: string, now: number): boolean` — true when `last.key === key && now - last.at < DOUBLE_TAP_MS`
  - `quickAction(line: { fouls: number; techs: number } | undefined): 'record' | 'open'` — `'open'` when `outReason(line) !== null`
  - `swapGuarded(swapShownAt: number | null, now: number): boolean` — true while `now - swapShownAt < SWAP_GUARD_MS`
  - `scrollBackAllowed(lastHandScrollAt: number | null, now: number): boolean` — false while `now - lastHandScrollAt < HAND_SCROLL_HOLD_MS`
  - `movedUp(before: string[], after: string[], top: number): string[]` — ids in `after.slice(0, top)` that were not in `before.slice(0, top)`
  - `quickLabel(tag: TeamTag, number: string, type: QuickPlay): string`
  - `numberAreaLabel(number: string, points: number, fouls: number, out: boolean): string`
  - `rowGroupLabel(tag: TeamTag, number: string, onFloor: boolean): string`
  - `movedUpText(numbers: string[]): string` — `#32 moved up`; two: `#32 and #10 moved up`
  - `ROW_TIP = 'Tap a number for 3s, free throws and fixes.'`
  - `feedbackLine(banner, unexported, toast, tip: string | null = null)` — when `toast` is null and `tip` is set, `entry = { text: tip, undoable: false, redoable: false }`
- Produces (`storage.ts`): `Prefs.rowTipShown: boolean`, fallback `false`, read like the other flags.

- [ ] **Step 1: Write the failing tests** in `live-logic.test.ts` (one `describe` per function). Sources: spec "Global Constraints" values above.

```ts
expect(SETTLE_MS).toBe(2000); // spec: owner decision 4
const k = quickKey('us', 'p1', 'FG2');
expect(isDoubleTap({ key: k, at: 1000 }, k, 1399)).toBe(true);   // invariant 3
expect(isDoubleTap({ key: k, at: 1000 }, k, 1400)).toBe(false);
expect(isDoubleTap({ key: k, at: 1000 }, quickKey('us', 'p2', 'FG2'), 1100)).toBe(false);
expect(isDoubleTap({ key: k, at: 1000 }, quickKey('us', 'p1', 'FOUL'), 1100)).toBe(false);
expect(isDoubleTap({ key: k, at: 1000 }, quickKey('them', 'p1', 'FG2'), 1100)).toBe(false);
expect(isDoubleTap(null, k, 0)).toBe(false);
expect(quickAction({ fouls: 5, techs: 0 })).toBe('open');      // invariant 4
expect(quickAction({ fouls: 1, techs: 2 })).toBe('open');
expect(quickAction({ fouls: 4, techs: 1 })).toBe('record');
expect(quickAction(undefined)).toBe('record');
expect(swapGuarded(1000, 1499)).toBe(true);                     // invariant 7
expect(swapGuarded(1000, 1500)).toBe(false);
expect(swapGuarded(null, 0)).toBe(false);
expect(scrollBackAllowed(1000, 5999)).toBe(false);
expect(scrollBackAllowed(1000, 6000)).toBe(true);
expect(scrollBackAllowed(null, 0)).toBe(true);
expect(movedUp(['a','b','c','d','e','f'], ['a','b','f','d','e','c'], 5)).toEqual(['f']);
expect(movedUp(['a','b'], ['a','b'], 5)).toEqual([]);
expect(quickLabel('Home', '23', 'FG2')).toBe('Home #23, 2 points');
expect(quickLabel('Away', '23', 'FOUL')).toBe('Away #23, foul');
expect(numberAreaLabel('23', 12, 3, false)).toBe('#23, 12 points, 3 fouls, more plays');
expect(numberAreaLabel('4', 1, 1, false)).toBe('#4, 1 point, 1 foul, more plays');
expect(numberAreaLabel('50', 0, 5, true)).toBe('#50, 0 points, 5 fouls, out, more plays');
expect(rowGroupLabel('Home', '23', true)).toBe('Home #23, on floor');
expect(rowGroupLabel('Away', '7', false)).toBe('Away #7, bench');
expect(movedUpText(['32'])).toBe('#32 moved up');
expect(movedUpText(['32', '10'])).toBe('#32 and #10 moved up');
expect(feedbackLine(null, null, null, ROW_TIP).entry).toEqual({ text: ROW_TIP, undoable: false, redoable: false });
expect(feedbackLine(null, null, { text: 'x', canUndo: true }, ROW_TIP).entry?.text).toBe('x');
```

In `storage.test.ts`: add `rowTipShown: false` to the `off` fixture and to every `toEqual({...})` literal (lines 284–315), plus one test that `{"rowTipShown":true}` reads `rowTipShown: true` with the others off. Update any existing `SETTLE_MS` test in `live-logic.test.ts` to 2000 (name it in the commit).

- [ ] **Step 2: Run** `pnpm vitest run src/ui/live-logic.test.ts src/core/storage.test.ts` — expected FAIL (missing exports / missing field).
- [ ] **Step 3: Implement** the exports above in `live-logic.ts` (use `countText` for the labels) and `rowTipShown` in `Prefs`/`loadPrefs`. Check every `savePrefs` caller (`grep -rn savePrefs src`) spreads the loaded prefs so the new flag is never dropped; fix any that builds the object by hand.
- [ ] **Step 4: Run** `pnpm check` — expected PASS.
- [ ] **Step 5: Commit** `git commit -m "1.1: rules for one-tap rows (guards, labels, 2 s settle, tip pref)"` naming the SETTLE_MS test change.

### Task 2: The rows, the scrolling list, and the one-tap path

**Files:**
- Modify: `src/ui/TeamHalf.tsx` (whole render; `TONE`; `useSettledLayout` adds the scroll listener)
- Modify: `src/ui/Live.tsx` (a `quick` handler and the `onQuick` prop; the tip)
- Modify: `e2e/fixture.ts` (finders), and every e2e test that read the old cards (`e2e/game.spec.ts:856-995`, `e2e/both-teams.spec.ts:177`, `e2e/game.spec.ts:1324,1600`, `expectCardsFit` callers)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `TeamHalf` prop `onQuick: (p: Player, type: QuickPlay) => void`. DOM contract the e2e relies on: each row is `role="group"` labeled `rowGroupLabel(...)`; inside it the number-area `button` labeled `numberAreaLabel(...)` and two buttons labeled `quickLabel(...)`; the list element is `data-testid="row-list"` (replaces `bench-region`); each half holds one `role="status"` element with `data-testid="swap-status"` and class `sr-only`. The row element carries `data-flash="1"` while flashing.

- [ ] **Step 1: Live.tsx.** Add `const lastQuick = useRef<QuickTap | null>(null)` and
  `quick(side: Side, p: Player, type: QuickPlay)`: compute `key = quickKey(side, p.id, type)`; if `isDoubleTap(lastQuick.current, key, Date.now())` return; set `lastQuick.current`; if `quickAction(lineOf({ side, p })) === 'open'` call `pick(side, p)`; else `record(side, p, type)`. Pass `onQuick={(p, type) => quick(side, p, type)}`. The tip: read `loadPrefs` once in a `useState` initializer; if `!rowTipShown`, hold `tip = ROW_TIP` in state and `savePrefs({...prefs, rowTipShown: true})` in a mount effect; pass `tip` to `feedbackLine`; clear the tip state once any toast exists.
- [ ] **Step 2: TeamHalf.tsx rows.** Replace the two-column grid and the `SPLIT_AT` split with one `flex flex-col gap-2` list inside a `relative min-h-0 flex-1` wrapper whose child `div` (`data-testid="row-list"`, `h-full overflow-y-auto`) scrolls, plus the 16 px fade. Row = `role="group"` `div` (`flex h-14 items-center rounded-lg pr-1`, fill from `TONE` `card`/`rest`, or the flash fill; ring via `ring-2 ring-inset` per Global Constraints; `mt-2` on the first rest row) holding the number-area button (`flex h-full min-w-0 flex-1 flex-col justify-center pl-2 text-left`; number `text-[28px] font-bold leading-none`; points placed so it cannot read as part of the number — e.g. `ml-2 text-sm font-semibold tabular-nums` in the `name` tone with a visible gap, or top-right; dots or OUT `text-xs` below) and the +2 / Foul buttons. Out rows: number area `opacity-50`, +2/Foul `border-dashed` with full-strength labels. Move the new fills (`quick`, `quickOutline`, `flash`, ring colors) into `TONE`, one border-color class per element. Drop `SPLIT_AT` and the old card markup.
- [ ] **Step 3: TeamHalf.tsx effects.** In `useSettledLayout`, also `document.addEventListener('scroll', arm, true)` (and remove it). Track `swapShownAt` (ref) and `lastHandScrollAt` (ref; set on the list's `onTouchMove`, `onWheel`, and `onPointerDown`-then-scroll — `onTouchMove` + `onWheel` suffice). When the shown layout changes by the settle wait (not by `settleKey`): set `swapShownAt = Date.now()`, flash the moved rows (`movedUp` ids plus the id(s) they displaced) for `FLASH_SWAP_MS`, set the status text to `movedUpText(numbers of movedUp)`, and if `scrollBackAllowed(lastHandScrollAt, now)` scroll the list to top (`behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`). Row +2/Foul `onClick`: if `swapGuarded(swapShownAt, Date.now())` return; else flash that row for `FLASH_TAP_MS` (not for an out row) and call `onQuick`. The number area calls `onPick` always.
- [ ] **Step 4: Controls.** +Play, Sub and the bench-tech button in one `flex gap-1.5` row (`min-h-11` each; bench-tech visible text `Tech`, keep its `aria-label` and the tech count styling); timeouts `min-h-11`. Update the component's doc comment.
- [ ] **Step 5: e2e fixture and existing tests.** `card(name)` → `half(ours).getByRole('button', { name: new RegExp(`^#${numberOf(name)},`) })`; `subIn`'s finder → `^#${n},`; `floorOf` → read the half's `role="group"` labels matching `/^(Home|Away) #(\S+), on floor$/`; add `row(side, number)` (the group), `quick2(side, number)` and `quickFoul(side, number)` (its buttons by exact `quickLabel`). Replace `expectCardsFit` with `expectControlsInView()` (each half's last timeout button's bottom ≤ the feedback line's top; `document.documentElement.scrollWidth <= clientWidth`; each half `scrollWidth <= clientWidth`) and update its callers. Rework the tests at `game.spec.ts:856-995` to the row DOM (the "bench" accessible-name checks move to the group label; `bench-region` → `row-list`; "10 + 10 fit with no scroll" becomes "10 + 10: controls in view, no sideways scroll"; the two 12-player split tests become one "12 players: one list scrolls, controls stay put"). Fix `both-teams.spec.ts:177` and `game.spec.ts:1324,1600` to the new number-area label. Any test that asserted an empty feedback line at game start now expects `ROW_TIP` (copy the string; e2e imports nothing from `src/`). List every replaced or deleted assertion in the commit message.
- [ ] **Step 6: Look at it.** `pnpm build && pnpm exec astro preview --port 4411 --ignore-lock` in the background; Playwright screenshot at 390×664 of a game with `#3` (0 pts) and `#30` (12 pts) and a 4-foul and an out player on both halves; save under the scratchpad, read the image, confirm points never read as part of the number and rings show through a flash. Stop the server.
- [ ] **Step 7: Run** `pnpm check && pnpm test:e2e` — expected all PASS.
- [ ] **Step 8: Commit** `git commit -m "1.1: one-tap rows on Live (+2 and Foul), one scrolling list per half"` with the replaced-assertion list.

### Task 3: Invariant tests

**Files:**
- Create: `e2e/one-tap.spec.ts`
- Test-only; no app code unless a test exposes a defect (then fix it in this task and say so).

**Interfaces:**
- Consumes: Task 2's fixture finders `row`, `quick2`, `quickFoul`, `expectControlsInView`, `floorOf`, and the DOM contract.

Use the fake clock (`page.clock.install()`, as `e2e/clock.spec.ts` does) for every timing test. Each test's comment cites the spec invariant it checks.

- [ ] **Step 1: Write the tests.**
  - `row +2 and popup +2 save the same event` (inv. 1): game A records #4 +2 by row, game B by popup; Plays CSV rows for that play are equal (same type, side, player, period); same for Foul.
  - `one row tap is one play and one tap` (inv. 2): read Usage CSV `plays`/`taps` before and after one row +2 (+1 each, minus the export clicks counted the same way `usage.spec.ts` does).
  - `a double tap records once; another player in the window records` (inv. 3): `dblclick` on #4's +2 → Home score +2 only; row +2 on #4 then #00 within 100 ms → +4.
  - `an out row opens the popup and records nothing` (inv. 4): foul #4 out by row Foul ×5 (taps 500 ms apart); then row +2 → dialog with `out-warning`; close; score unchanged.
  - `the swap moves the player up after 2 s, scrolls to top, and leaves the saved game alone` (inv. 5): 7-player roster; scroll `row-list` down, row +2 on #44; at 1.9 s `floorOf` unchanged; at 2.1 s #44 is in the top block, `row-list.scrollTop === 0`, `swap-status` reads `#44 moved up`; Plays CSV equals the one exported before the wait.
  - `10 and 15 players a side: controls in view, nothing scrolls sideways` (inv. 6): 390×664; 10 v 10 and 15 v 15 via Setup rosters → `expectControlsInView()`; plus a game with no opponent roster: Away half has no `role="group"` rows and its controls are in view.
  - `the swap guard holds that half's row buttons for 500 ms only` (inv. 7): after a Home swap shows, Home row +2 at +100 ms records nothing, Away row +2 at +100 ms records, Home number area opens the popup at +100 ms; Home row +2 at +600 ms records.
  - `row +2 then Undo leaves the game as before` (Review Focus 1): score and toast match a popup +2's Undo.
  - `hand scroll holds the list for 5 s` (Review Focus 4): wheel-scroll Home list, row +2 on a lower player, advance 2.1 s → swap shows, `scrollTop > 0`.
  - `the first live screen shows the tip once per device`: first game's feedback line reads `Tap a number for 3s, free throws and fixes.`; after New game it does not.
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/one-tap.spec.ts` — PASS (these test behavior Task 2 built; any FAIL is a defect: fix the app and record it in the commit).
- [ ] **Step 3: Run** `pnpm check && pnpm test:e2e` — PASS.
- [ ] **Step 4: Commit** `git commit -m "Test: one-tap rows invariants 1-7"`.

### Task 4: Docs, How-to and colors

**Files:**
- Modify: `src/ui/howto-content.ts` (sections at lines 28, 38-41, 49, 58-59, 97, 100 alt text), `src/ui/howto-content.test.ts` if it pins wording
- Modify: `docs/colors.md` (Blue row; Gray row's card wording; the tone table; contrast notes for the new fills and rings)
- Modify: `docs/backlog.md` (the spec's "Not in 1.1" backlog items with their triggers: free-throw strip, shorter rows on short screens, back-swipe padding, swap-tap logging; names on rows as an option)
- Modify: `CHANGELOG.md` (`## [Unreleased]` bullets)
- Regenerate: `public/howto/*.png` via `pnpm howto:shots`

- [ ] **Step 1: How-to.** Rewrite card wording to rows in the app's voice: each player is a row with their number; +2 and Foul are one tap; tap the number for 3s, free throws, techs, fixes and subs; the list scrolls; a lower player who scores moves up into the top five 2 seconds after you stop tapping and the list scrolls back up; Tech (beside + Play) records a bench or coach tech. Update image alt text to the new screen.
- [ ] **Step 2: colors.md.** Blue: add "a row just recorded or moved (sky-100 fill on Home, sky-900 on Away)". Gray: rows replace cards; +2 filled, Foul outlined. Measure and record contrast (WebAIM formula, by hand or a one-off script in the scratchpad) for: +2 border on its fill and on both row fills, both tones; amber and red rings on card, rest and flash fills; the points gray on each fill. Any pair under 3:1 (rings, borders) or 4.5:1 (points text) is fixed in `TONE`, not just recorded.
- [ ] **Step 3: backlog and CHANGELOG.** CHANGELOG Unreleased bullets: one-tap +2 and Foul rows, no names on rows, the scrolling list with the 2 s move-up and scroll back, the tap guards, Tech beside + Play, the first-use tip.
- [ ] **Step 4: Run** `pnpm howto:shots`, read each regenerated PNG (invented names only), then `pnpm check && pnpm test:e2e` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Docs: How-to, colors and backlog for one-tap rows"`.

### Release (controller, after the final review)

- `pnpm release minor` → 1.1.0 (runs the full-game test and the shots). Do not push.

## Invariants

| # | Invariant (spec) | Checked by |
|---|---|---|
| 1 | Row +2/Foul save the popup's event | `one-tap.spec.ts` "row +2 and popup +2 save the same event" |
| 2 | One-tap play: +1 plays, +1 taps | "one row tap is one play and one tap" |
| 3 | Double-tap guard: same side/player/play within 400 ms only | `live-logic.test.ts` `isDoubleTap`; e2e "a double tap records once…" |
| 4 | Out rows never record | `quickAction` unit; e2e "an out row opens the popup…" |
| 5 | Display order never changes the saved game | e2e Plays CSV equal across the swap; `lineup.ts` unchanged (diff shows no edit) |
| 6 | 10 and 15 a side on 390×664: controls in view, no sideways scroll | e2e "10 and 15 players a side…" |
| 7 | Swap guard: that half only, 500 ms only | `swapGuarded` unit; e2e "the swap guard holds…" |
