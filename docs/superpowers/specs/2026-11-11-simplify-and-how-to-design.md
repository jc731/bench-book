# Simplify the UI and move help to a How-to page: design

Status: approved after adversarial critique, with owner rulings. Owner goal and decisions as of 2026-11-11.

## Intent

The owner wants to know how simple the app can get. Cut until something has been cut
too far, then add that one thing back. There is one app for everyone, with no newbie
mode. A newcomer who has a general sense of what a scorebook tracks should be able to
handle the "what am I doing" moments from the screen alone. An experienced scorer
should be no slower than today.

Explanations do not belong on the game screens. They live on one **How to use** page,
which most people should never need.

## Goals

- Every ref's call and every book entry can still be recorded. A cut that loses one has
  gone too far.
- An experienced scorer needs no more taps than today for these actions:

  | Action | Taps |
  |---|---|
  | basket or foul | 2 |
  | opponent points | 1 |
  | timeout | 2 |
  | free-throw pair | 4 |
  | end of quarter plus check | 4 |

- All player cards fit on screen with a 7-player roster on a 390×664 viewport, which is
  iPhone 13 Safari with its bars.
- Controls show they can be tapped by how they look, not by labels that explain them.
- Help is one in-app page that works offline, with screenshots that a script keeps up
  to date.

## Non-goals

- Tips, coach marks or first-run hints anywhere in the UI. The owner ruled these out.
- A practice or demo game. Add it if a real volunteer still gets stuck after this round.
- A newbie mode.
- New stats or rules changes.
- Changes to the data model beyond what a cut makes dead.

## Anti-goals

The design has failed if any of these is true:

- A ref's call (foul, technical, bench technical, any timeout kind, a free throw, a
  basket) has no place to be recorded.
- The quarter check can be passed without entering the book's number.
- A mismatch can be left unresolved without being noted.
- The scorer loses Undo or game state by opening the How-to page.

## Decisions

The owner's decisions are marked **(owner)**. Everything else is my call or the
minimalist pass's, so it can be challenged.

### Live screen

1. **The bottom bar becomes one row:** `Timeout · Undo · Log · End Qn · ⋯` **(owner, for
   the single row)**. The Opp +1/+2/+3 row stays above it, and only when opponent
   tracking is on.
2. **Bench tech leaves the bottom bar and becomes a "Bench" card at the end of the
   player grid.** Tapping it opens a sheet with one action, Bench tech. That is 2 taps, up
   from 1. It is not on the protected list.
   - **Why a card and not the Timeout sheet (critique, changed from the owner's first
     idea):** a scorer who hears "technical" looks for a *who*. A card is where they
     already charge people. A bench tech hidden among the timeout kinds invites a novice
     to charge a player's Tech foul instead, which is an anti-goal. A mis-tap among the
     timeout kinds would also add a team foul and move the bonus.
   - There is room for the card. With a one-row bar, about 170px of the screen is spare
     (measured from the CSS).
3. **One line above the bar does all the feedback.** It is full width and stays put
   rather than fading. It shows the last entry with its Undo: "#12 +2 — bonus [Undo]",
   and after an undo, "Undid #12 +2". It is feedback, not a tip.
   - The "Qn not checked — Check" prompt and the "not exported" warning use the same
     line, and take priority over it when they apply.
   - The bottom bar keeps Undo, so Undo stays reachable when the line shows a prompt. The
     toast's floating Undo is cut, so there are never two Undos in view.
   - The always-reserved 44px band under the score is cut.
   - After a reload, the line shows "Last: #12 +2" with Undo disabled.
   - (The minimalist pass wanted to put the toast inside the Undo button. The critique
     rejected that: at about 68px, the button truncates "— 5th, out", and after an undo it
     would show the *previous* play, which reads like a failed undo.)
4. **Log and the quarter check keep their own feedback line and Undo,** in the same
   style. A Delete from Edit always shows "Deleted #12 +2 [Undo]".
5. **After End game the game looks finished.** The strip shows "Final" instead of the
   quarter, and the End Qn slot becomes "Final ▸", which opens the Final screen. The
   separate "Game ended" bar is cut.
6. **The game ends only from the last-period sheet.** That means End Q4… or End OTn…,
   choosing "End game (no overtime)".
   - **The ⋯ menu:** How to use · Running score · Final / export · New game. "Final /
     export" only opens the Final screen; it never ends the game.
   - **Final gets "Reopen game"** for an ended game. It clears the end and returns to the
     last period. Undo is lost after a reload, so without this an ended game has no way
     back.
   - (Critique, measured: ending at once from ⋯ could not be recovered after a reload.)

### Player sheet

7. **All six plays stay:** +2, +3, FT made, FT missed, Foul, Tech foul. Each is a mark in
   the book.
8. **Status line, Undo and Done stay.** This is the only Undo visible while the sheet is
   open.
9. **Tapping the backdrop closes the sheet (owner).** It already does. Verify it, and make
   sure Done reads as the primary button.

### Log

10. **Rows look like buttons (owner):** a full-width bordered row with a chevron.
11. **The Log screen is newest first throughout,** as the v1 spec says: the newest
    quarter on top, and the newest play on top within each quarter.
    - The quarter check's embedded log is the exception. It stays oldest first, because
      the scorer walks it alongside the book's running score.
12. **Tapping a row opens Edit directly.** The intermediate actions sheet is cut. Delete
    moves into Edit's footer. A late fix goes from 6 taps to 5.
13. **The Edit sheet names the play (owner),** for example "Fix: #12 +2 · Q1". Its three
    groups are labeled Play, Player and Quarter.
14. **"Move to another quarter…" merges into Edit's Quarter group.** Picking another
    quarter shows a checkbox, "Also move the N plays after it in Qn", which is off by
    default. This is how a missed End Q gets fixed.
15. **"Add a missed play before this" is cut.** Missed plays are added through the check
    screen's "Add play to Qn", which places them at the end of that quarter. The cost is
    that the running-score grid and the Plays CSV no longer show a late-added play in
    the order it really happened. That reverses a v1 spec call. See the riskiest cuts.

### Quarter check

16. **The check screen stays as shipped, except the Hide/Show toggle on the embedded log
    is cut.** The log always shows when there is a mismatch.

### Setup

17. **The opponent and the roster come first (owner).** A "First time here? How to use"
    link sits at the top **(owner)**.
18. **Home/Away stays visible,** as one toggle beside the opponent. It is wrong for about
    half of all games if nobody sees it, and it goes into the Book CSV header.
    - The rest folds into a closed "Game details" section: the date (default today), Our
      team, Coach, Scorer, Timekeeper, and "Also keep their score".
    - **"Also keep their score" is remembered** from the last game.
    - Game details also holds a guarded "Clear saved roster" (see 20).
19. **The POS input is cut.** A row is #, Name and ×. The `pos` field stays in the
    data, but saving a roster from Setup writes it blank, so stale hidden positions don't
    linger. The Book CSV keeps its POS column, blank.
20. **"Clear saved roster" moves into Game details and gets a confirm.** It is the only
    way to wipe minors' names from a borrowed phone without starting a game: Start needs
    at least one player (measured).
21. **The iOS "Add to Home Screen" tip and the version line move to the How-to page.**
22. **The New-game guard reads the both-files export rule.** When a game was already
    exported, it says "Exported ✓" and makes Discard the primary button.

### Final screen

23. **Final keeps:** the score, two export buttons with the saved state of each file and
    a short description, and the open quarters with their notes.
24. **Final cuts:** the "Exported. The paper book stays official." line (the per-file
    state shows it), the variant for a game that hasn't ended, and "Finish game".
    - Its footer is "Back to game" and "New game".
    - The note on how open quarters export moves to How-to.

### Running score

25. **Running score stays in ⋯ and gains a one-line legend** of its marks.

### How to use page

26. **An in-app view, like Log (owner),** reached from the Setup link and from ⋯.
    - Back returns to the view it was opened from.
    - It needs no navigation and no reload, so Undo and game state survive.
27. **Images are PNG files in `public/howto/`.** The service worker's precache glob
    covers png but not webp or jpg. That means the page works offline.
28. **The text comes first, with about three screenshots:** Reading the screen, Mistakes,
    and End of quarter. More only where a section can't be understood without one.
    - The images come from a Playwright script, `pnpm howto:shots`, that reuses the
      full-game e2e fixture (invented names). It is not a second scripted game.
    - `pnpm release` runs the script, so the images are refreshed on every release. A
      reminder in CLAUDE.md alone would not keep them current.
    - The owner can replace any image by hand.
29. **Sections,** each with one or two sentences; three of them carry a screenshot:

    | # | Section | Covers |
    |---|---|---|
    | 1 | What this is | It sits beside the paper book, which stays official. |
    | 2 | Before tip-off | Opponent, roster, Game details, and Add to Home Screen on iPhone. |
    | 3 | Record a play | Tap the player, then the play. |
    | 4 | Free throws | The sheet stays open for the second shot; tap Done. |
    | 5 | Timeouts and bench techs | Both are under Timeout. |
    | 6 | Their points | Turn them on in Game details. |
    | 7 | Mistakes | Undo right away, or Log, then tap the line to fix or delete it. |
    | 8 | End of quarter | End Q, Check, the book's Score by Qtr box, Save or Later, and fixing a mismatch. |
    | 9 | Overtime and end of game | |
    | 10 | Export | What each file is, the 72-hour clear, and how open quarters export. |
    | 11 | Reading the screen | Foul dots, amber at 4, red OUT, the bonus, timeouts left, and the running-score marks. |
    | 12 | If something's wrong | The not-saving banner; a reload keeps plays but clears Undo; updates; the version. |

## Riskiest cuts and their add-back triggers

| Cut | Add back when |
|---|---|
| Floating toast replaced by a fixed line (3) | A persona or a user misses a wrong-player tap, or says they weren't sure a tap registered. |
| Insert-before (15) | Someone needs a late-added play in its true order, for example to match the book's running score, or Phase 2 book generation needs it. **This one has a data cost that can't be undone:** games scored before the add-back keep the approximate order for good. That is the owner's question 2. |
| Bench tech as a grid card (2) | A newcomer hunts for it for more than about 10 seconds, or records it as a player tech. |
| POS input (19) | Anyone asks for positions in the Book CSV. |
| iOS tip moved (21) | A roster is lost to iOS clearing storage. That is the v1 spec's own trigger. |
| Game details folded (18) | Book CSV headers come back blank and someone minds. |

## Code that goes dead

Keep `insertEventBefore`, `Player.pos` and `GameEvent.order`, with their tests. They are small, and they are what an add-back would use. Remove `insertLabel`
and any UI-only helper that loses its last caller.

## Owner rulings (2026-11-11)

1. **Games can end early, but it's rare.** Final gets "End game early" while the game
   is still live, with a confirm. "Reopen game" covers a mistake.
2. **True play order matters for Phase 2, but it can come late.** Keep insert-before cut.
   Weigh reconcile features against clutter and confusion. Games scored before the
   add-back keep their approximate order, and the owner accepts that.

## How we'll know

Rerun the four persona agents, using the same brief and scenario as the 2026-11-11
swarm:

- The parent and the novice finish all of their events without guessing.
- The veteran's tap counts don't rise above the table in Goals.
- No persona records a ref's call wrongly because a control moved.
- The full-game e2e test is updated, and its expected numbers don't change.

## Left to the builder

- Exact Tailwind classes and sizes, within the 390px width and 44px tap targets.
- How the Undo button's second line is truncated.
- The wording of the How-to text, within the section table above.
- The sample game used for the screenshots.
