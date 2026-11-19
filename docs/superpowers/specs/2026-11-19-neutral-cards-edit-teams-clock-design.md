# Neutral cards, usage counter, Edit teams, timeout clock (0.10)

Status: scope agreed with the owner 2026-11-19, after the second real game, which was run on 0.9.2
without keeping the book. The neutral cards and the usage counter went through a designer pass and a
critique on 2026-11-18. Edit teams and the clock were critiqued on 2026-11-19 (scratchpad
`v010/critic-edit-clock.md`). The calls marked *Claude's call* are for the owner to check.

The owner chose to put Edit teams and the clock in 1.0, ahead of the stats page (0.11). Neither is on
the 1.0 checklist. The owner can make that call; it is recorded here and in the checklist.

## Why

- **Neutral cards (owner, 2026-11-18).** Table the floor/bench emphasis and move back toward neutral
  cards, keeping the top five first, with light differentiation at most. The Setup Starts toggle is
  **out** (owner, 2026-11-19: "still torn ... good to leave it out until we can nail it well").
- **Usage counter (owner, 2026-11-18).** "Love tap count + fixes, because ideally we see both going
  down over time." The Plays CSV records no undo, redo, delete or late add, so it can't measure
  fixes today. 1.1 (efficiency) needs a baseline.
- **Edit teams (owner, 2026-11-19).** At the second game the owner arrived late, kept no lineup sheet,
  and built rosters through + Play → Whose number?. "We need a menu item to take us to the edit team
  page we see at start so we can add/edit players there." What Whose number? can't do (measured in
  the code):
  - add a player without recording a play;
  - set a name;
  - fix a mistyped number: nothing can remove or renumber the card it made.
- **Timeout clock (owner, 2026-11-19, a "bonus quest").** For when nobody else is running the clock:
  taking a timeout shows a 60 or 30 second clock with Start and Reset, and a cue at the warning point and at 0:00 (visual only; see decision 19). Off by default,
  behind a page of experimental settings.

## Goals

- Every card looks the same except a fault state (amber at 4 fouls, red when out); the top five
  still lead.
- Each game records how many taps and fixes it took, exported without names.
- A roster can be fixed mid-game, both teams, without recording a play.
- With the experiment on, a timeout gets a visible countdown that never blocks scoring.

## Non-goals (0.10)

- Starters in Setup. Trigger: the owner settles how the lineup should work (backlog).
- Merging a stray number into the real player (a #21 that should be #12): the duplicate check blocks
  it, and per-play Log edits still work. Trigger: a stray number with more than about 2 plays.
- Saving the roster from Edit teams for the next game. A roster built through Whose number? has no
  names and would overwrite last game's. Trigger: the owner has to retype names.
- Reordering players in Edit teams.
- A jersey change mid-game (the blood rule): past plays would show the new number. Trigger: the first
  one at a game.
- Any sound. The owner asked for a visual cue only; the iOS silent switch would mute web audio
  anyway. Trigger: the owner misses the cue at a game.

## Anti-goals

It fails, even if it works, if:
- an Edit teams save changes any score, foul, timeout count or who is on the floor;
- the clock writes to the game (a save, an undo step, a lost export mark);
- the clock covers the cards or the Sub button during a timeout;
- anything new appears for a scorer who never turns the experiment on.

## Approaches considered

- **Cards:** identical cards sorted (A), a fill step after the fifth (B, chosen by the owner
  2026-11-19), and the 0.9 ghost without its tag (C). A divider doesn't fit at 10 a side (51 px short).
- **Usage counter:** inside the game (rejected: undo restores whole-game snapshots and would erase
  its own count) vs. **its own storage key per game** (chosen).
- **Edit teams:** improving Whose number? (rejected: it can't add a name or remove a card without new
  UI there either) vs. **Setup's roster editor in its own view from More** (chosen).
- **Clock:** a modal sheet (rejected by the critic: tapping a card behind it only closes it, and
  timeouts are when subs and late free throws happen) and a chip in the status strip (rejected: it
  doesn't fit beside the bonus badge) vs. **a band above the bottom bar** (chosen). No audio (owner).

## Decisions

### Neutral cards

1. **One card style.** Every card is solid with the same 2 px border. The ghosted bench look and the
   "bench" tag go. Screen readers still hear ", bench".
2. **Fill step.** Cards after the first `layoutFloor` (five at the start) get a fill one step toward
   the half's background: Home `slate-100` on white (grayer), Away about halfway between slate-800 and
   slate-900. Border and text unchanged. This is the light differentiation. A gray, so no new color
   job; README § Colors updated.
3. **The Sub button is always gray.** It reads **Starters** before the team's first play (Setup ticks
   are out, so it stays the way to set starters), and **Sub** after. The amber "Sub · 6 on" and the
   count go. The sub sheets ("Who went out?", "Who came in?", "Who's on the floor?") and the play
   sheet's "#22 checks in" / "#10 comes out" row stay.
4. **The toast suffix " · now on the floor" goes.** Promotion stays in the replay, silent.
5. **An incoming player takes the outgoing player's slot.** At a sub, each `ins[i]` swaps places with
   `outs[i]` in the previous layout; then the floor moves to the front, keeping order (a stable
   partition). Unpaired ins go to the end of the floor block, unpaired outs to the front of the bench.
6. **Checklist wording.** "A fouled-out player prompts a sub" becomes "A foul-out takes the player off
   the floor and tells the scorer to tell the official", since the amber prompt goes.

### Usage counter

7. A per-game record under its own key (`benchbook:usage:<gameId>`, demo prefix in demo), outside the
   game and so outside undo. Removed when the game is discarded or purged.
8. Counts:
   - **taps**: every button activation while a game is open, on any view but Setup;
   - **plays**: plays entered from live;
   - **undos**, **redos**;
   - **edits**: Log fix-sheet saves;
   - **deletes**;
   - **lateAdds**: plays added from a check (and from the 0.11 stats page);
   - **subs**: subs recorded;
   - **teamEdits**: Edit teams saves.
   Fixes = undos + edits + deletes + lateAdds.
9. Final offers a third download, **Usage CSV**: one row with the game date, app version, each count,
   taps per play and fixes. No team, opponent or player names. It isn't part of "Exported": the Book
   and Plays CSVs alone set that mark.

### Edit teams

10. The More menu gains **Edit teams**. It opens its own view (not Setup, so the wake lock holds and
    Setup's discard prompt never shows): our team name, the opponent name and both rosters, reusing
    Setup's roster editor, with **Save** and **Cancel**.
11. **Save is one undoable entry**, "Edited teams", through `update`. Same validation as Setup. A blank
    opponent name falls back to `opponentOrDefault`. Our saved roster for the next game is not
    touched.
12. **Players keep their id**, so renumbering or renaming changes how past plays read (Log, both CSVs)
    and nothing else. A corrected roster matches a corrected book.
13. **New players go at the end; nothing reorders.** Roster order sets the starting five until the
    first sub, so moving players would change who started.
14. **× only for a player with no plays and in no sub.** Otherwise the button is disabled and the row
    says "has plays".

### Experiments and the timeout clock

15. A gray **Experiments** item at the foot of More opens a page of per-device settings, stored in the
    existing prefs key (not the game, roster or demo keys; "Clear saved roster" leaves it alone).
    First and only setting: **Timeout clock**, off by default.
16. With it on, a timeout from Live's buttons (including "Take anyway") opens the clock: 60 s for a full
    or OT timeout, 30 s for a 30. Timeouts added from the Log or a check don't.
17. **The clock is a band above the bottom bar**, in place of the feedback line while it shows: big
    `m:ss`, **Start/Pause**, **Reset**, and **×**. It doesn't start by itself (timeouts are often tapped
    late). Cards, Sub and the sheets stay usable.
18. **It keeps running across views.** Its state lives in the store as an end time, not a ticking
    count, so leaving Live for the Log, the check or Running score, or the phone sleeping, doesn't
    lose time. It shows on Live only. It isn't saved across a reload.
19. **No sound (owner, 2026-11-19: "just a little pop up is sufficient. horn could be annoying").**
    The "horn" is visual. At the warning point the band shows a short note, "15 seconds" (or "30
    seconds"), and the time turns amber. At 0:00 it shows **Time** in red until × or Reset. The
    warning is halfway, as the owner wrote it ("15 seconds and 30 seconds for 30/full timeouts"),
    and is one constant, so switching to "15 s left on a full" (the NFHS warning, as far as the critic
    recalls) is a one-line change. README § Colors updated.
21. Undoing the timeout doesn't touch the clock.

## Constraints

- One thumb, iPhone 13 (390 × 664), 10 a side with no scroll; tap targets at least 44 px.
- Colors per `README.md` § Colors.
- 1.1 one-tap buttons won't fit 44 px on today's 88 px cards, so nothing goes inside the cards now.

## Data invariants (each is a test)

1. An Edit teams save leaves `events` and `subs` deep-equal.
2. It leaves every score, team foul, timeout count and player line's numbers unchanged.
3. After it, every play's `playerId` is still on its team's roster.
4. Renumbering, renaming or adding a player leaves the floor unchanged.
5. The Book CSV changes only in names and numbers; the Plays CSV only in its number and player columns.
6. Undo after an Edit teams save restores the game deep-equal; the save clears `exported`.
7. The clock never writes to the game: no save, no undo step, `exported` kept.
8. Time left never goes below zero, and the warning and Time cues each appear once (a pure function on a fake clock).
9. With the experiment off, no clock appears; e2e and `/ux-audit` run with the default.
10. Usage counts survive an undo (an undo adds one to `undos` and removes nothing).
11. The usage CSV holds no team, opponent or player name.
12. The card order after a 1-for-1 sub differs from the order before it in exactly two places.

## Left to the builder

- The Away fill-step shade (check contrast on a device), and the clock band's layout at 390 px.
- How taps are counted (one capturing listener on `button` clicks is enough).
- Tests: unit tests for the invariants and decisions 5, 13, 14 and 19; e2e for Edit teams (add, rename,
  can't remove a player with plays, undo) and for the clock with the experiment on.
- The How-to (Edit teams; the clock is an experiment and stays out of it) and the changelog.
