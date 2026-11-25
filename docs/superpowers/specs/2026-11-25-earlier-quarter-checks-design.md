# 1.2: a way back to earlier quarters, and a per-player check (design, 2026-11-25)

## Intent

At a real game on 1.1.0 the owner missed a Q1 foul, caught it at half time comparing books with the
other scorer, and could not find a way to put it into Q1: they looked at the live screen, the player's
popup and the Q2 check, then added it to Q2 instead ("easier to get the number right, but not good log
keeping"). The same session had a foul on the wrong team. Both fixes exist today, two screens deep:
Book → Plays has a status chip per finished quarter that reopens that quarter's check, and the check
already holds "Add play to Qn" and the quarter's plays with Fix. Nobody found them. The owner also
wants the quarter check to compare more than the score, which is usually right by then: a per-player
summary for the quarter being checked.

## Approaches

- **A. Quarter tabs on the check page (chosen).** The one place the owner was looking at half time.
- **B. A More menu item (chosen, as one page).** For the case A cannot reach: on the live screen in Q3,
  remembering a Q1 foul. Opens the same check page; the tabs do the listing. No separate list screen.
- **C. "Earlier quarter…" in the player popup.** Fits "forgot #12's foul in Q1" but adds a step to the
  popup used all game and cannot fix a wrong-team foul. Backlog; trigger: a missed foul that still gets
  past A and B at a game.

## Decided

1. **Tabs.** The check page's header gets a row of quarter tabs, one per finished period (every
   period before the current one; the current one too once the game has ended), in order. A tab reads
   its label (`Q1`, `OT1`) with the status tone the Book's chips use (green matched or fixed, amber
   unresolved, gray pending or noted); the open quarter's tab is marked current. Screen readers hear
   `Q1, ✓ Matched`. Tapping a tab opens that quarter's check and keeps the same return view (Live,
   Book or Final). What was typed on the quarter being left is kept as a draft, exactly as Later keeps
   it, so switching tabs never loses a number. With one finished period there is one tab.
2. **More → "Quarter checks".** Shown once any period is finished. Opens the check for the latest
   finished period, returning to Live.
3. **Per-player table for the quarter.** The check's "Player fouls, whole game" list becomes a table
   per team (Home first, as the fouls are today): `#` and name, points in this quarter, fouls in this
   quarter, fouls whole game. The No number row shows when that team has a no-number play. Team fouls
   for the quarter stay above it. The heading says the quarter: `Players in Q2 (compare with the book)`.
4. Nothing else on the check changes: score fields, the compare panel, Add play, the plays list with
   Fix, Note, Later and Save.

## Invariants (each a test, or marked not checked)

1. Opening a tab never changes the saved game or any check's status.
2. Switching tabs with a typed score keeps it: coming back shows the same text.
3. In the per-player table, the quarter's points summed over rows (No number included) equal that
   team's points for the quarter, and the whole-game fouls equal the live screen's dots.
4. "Quarter checks" is absent in Q1 before any period ends, present after End Q1, and opens Q1's check.

## Not in 1.2

C above. Restoring the score hint (the owner's "other direction" is the per-player table, not the
hint). The How-to gets a line on tabs and the menu item.
