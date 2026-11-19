# Player stats page (0.11)

Status: scope agreed with the owner 2026-11-18 ("0.10 and .11 are good to go") and 2026-11-19 (1.0 =
this page plus the 0.10 items). It went through a designer pass and a scorekeeper/QA critique on
2026-11-18. The calls marked *Claude's call* are for the owner to check.

## Why

The 1.0 checklist item: "A player stats page: each player's points and fouls by quarter, for both
teams, where a play can be added or fixed for a given quarter, mid-game or at the quarter's end."

What the first real game (2026-11-17, 0.9) measured:
- **A 5th foul was missed, and nothing caught it.** The book had a foul-out the app doesn't show.
  The owner thinks it was late in Q2 or Q4, when attention fades.
- **No fix was made in the app during the game.** Every row reads `edited = no`, and no play was
  added to an earlier quarter. The fix paths that exist (the Log's fix sheet, the check's "Add play
  to Qn") went unused. What is missing is a view that makes a miss visible.
- The book is laid out by player, with fouls boxed by quarter. The Log is laid out by time. At a
  break, or at halftime with the other scorer, the comparison is row by row, by number.

## Goals

- At a break, compare the app with the book row by row: each player's points and fouls by quarter,
  both teams.
- Add a missing play to a player and quarter in one tap from that cell. Fix a wrong one through the
  existing fix sheet.
- A missed 5th foul, added late, says what the live screen says: "Tell the official."

## Non-goals (0.11)

- Rebounds, assists and other stats. They would live on this page later (1.x).
- Team-level adds (timeouts, bench techs) from the footer rows. They stay on the live screen and the
  check.
- Placing a play mid-quarter. Plays go at the end of their quarter. Trigger: a real game where
  end-of-quarter placement made a foul-out or bonus read wrong at the time.
- Comparing team fouls at the quarter check. Trigger: a second real game with a missed foul.
- The book's marks (`2 3 FT 0`) in cells. Trigger: a check mismatch the point sums hid.
- Both teams side by side. 390 px can't hold two grids.

## Anti-goals

It fails, even if it works, if:
- the page becomes a second way to edit a play (the Log's fix sheet is the only one);
- a play added to an earlier quarter changes who is on the floor now (audit 0.9.0 F1);
- adding a play reopens an ended game, or leaves "Exported ✓" on a game that changed;
- the grid's rows don't add up to the team's points and fouls.

## Approaches considered

1. **A read-only grid, with a row tap opening the check's Add play** (the critic's minimal cut).
   Cheaper, but a missed foul takes 5+ taps.
2. **A grid whose cells open a sheet that lists and adds** (chosen). The cell is where the scorer's
   eye already is when the book and app disagree. 4 taps from live for a missed foul.
3. **Inline +/− on cells.** Rejected: tiny targets, and "−" has to guess which play to delete.

Entry: **the bottom bar's Log becomes Book**, with Players and Plays tabs (chosen; *Claude's call*
from the 2026-11-18 proposal, which the owner didn't object to). A separate Stats button in ⋯ was
rejected: it costs a tap and a menu at the moment the owner's missed foul needed it. A button on
the check only was rejected: the owner wants mid-game too.

## Decisions

### Where it lives

1. The bottom bar's **Log** button reads **Book**. Book opens on the **Players** tab. **Plays** is
   today's Log, unchanged. The tab choice is kept until the app reloads.
2. A **Home | Away** toggle under the tabs, each showing the team name and score, Home first. It
   starts on Home and keeps the last pick until the app reloads. Home rows are light and Away rows
   dark, as on the live screen.

### The grid

3. Columns: player (78 px), Q1–Q4, every OT up to the current period (an OT column shows even with
   no plays in it), total (56 px). With no OT the quarter columns widen to fill. Past OT2 the grid
   scrolls sideways.
4. Rows: the roster in roster order, then **No number** when that team has plays with no player,
   then two footer rows: **Team** (points and team fouls per period) and **Score** (the running
   score after each period, the book's Score by Qtr). Rows are 48 px; the header and the toggle stay
   pinned and the rows scroll.
5. A player cell: `#N` over the name, truncated, and a 3 px left bar: gray, amber at 4 fouls, red
   when out.
6. A quarter cell: that quarter's points, large, over one dot per foul (techs included) that
   quarter. A cell with nothing shows a faint `·`. A quarter with only missed free throws shows `0`.
7. The total cell: points, then `F n`. `F 4` is amber. Out shows **OUT** in red. With any tech,
   `T n` follows.
8. Colors follow the table: amber caution, red out, gray the rest. No new color job.

### The cell sheet

9. Tapping a player's quarter cell (or the No number row's) opens a sheet titled
   `#5 Casey Moreno (Home) · Q2`:
   - a line with that quarter's points and fouls and the game totals;
   - that cell's plays, oldest first. Tapping one opens the existing Log fix sheet;
   - **Add to Q2**: the six play buttons of the live play sheet (+2, +3, FT made, FT missed, Foul,
     Tech foul). Each records on one tap. The sheet stays open and the list gains the new play;
   - the feedback line with Undo, and **Done**.
   The footer rows and the total cells are not tappable.
10. An add goes through `appendEvent` with that period: **at the end of its quarter**. In the
    current quarter of a game in progress, that is the same as a live tap. Each add is one undo
    step.
11. **A late add doesn't promote.** A play added to a quarter before the current one (or to any
    quarter of an ended game) carries `late: true`, and `lineup()` skips promotion for it. It still
    counts toward fouls, so a 5th foul added late puts the player out. The check's "Add play to Qn"
    sets the same flag, which closes audit 0.9.0 F1.
12. **Feedback for an add**, built from the game before and after:
    - base: `Added #5 (Home) Foul to Q2` (the check's existing wording);
    - when it puts the player out: `#5 (Home) out, 5 fouls. Tell the official.` (or `2 techs`), red,
      as on live;
    - when a saved check for that quarter was matched or fixed and now isn't: `· Q2 check now 2 over`
      (amber);
    - when it changes the current bonus: the live toast's bonus suffix.
13. **An ended game** accepts adds, as the check and the Log already do. `endedAt` is kept, the
    export mark clears, and Final shows "Not exported" again.
14. The usage counter (0.10) counts each add as a late add when it's `late`, and as a play otherwise.

## Constraints

- One thumb, iPhone 13 (390 × 664). Tap targets at least 44 px (rows are 48).
- Colors per `README.md` § Colors.
- Every play names its team in feedback and the Log.
- The Book and Plays CSV formats don't change. The `late` flag is not exported.

## Data invariants (each is a test)

1. For each team and period, the player rows plus No number sum to the Team row's points.
2. For each team and period, the player rows' fouls plus bench techs equal the Team row's fouls.
3. The Score row is the running sum of both teams' Team rows, and its last column equals the score
   on the live strip.
4. An add to period p changes only column p and the totals of that row, the Team row and the Score
   row from p on.
5. A late add never adds anyone to the floor; it may only remove a player who fouls out.
6. An add to an ended game keeps `endedAt` and clears `exported`.
7. `foulsByPeriod` summed over periods equals `fouls` for every player line.

## Left to the builder

- `foulsByPeriod` on `PlayerLine` in `derive.ts`; everything else on the page is already derived.
- Tests: unit tests for the invariants and decisions 10–13; e2e for Book → Players → cell → Foul →
  Done putting a player out, and for the tabs.
- The How-to and changelog.
