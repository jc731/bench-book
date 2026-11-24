# 1.1: one-tap rows (design, 2026-11-24)

## Intent

Fewer taps per play without more mistakes. At the 2026-11-23 game (both teams, 0.12.2) the
owner recorded 61 plays in 182 taps: 25 twos, 2 threes, 13 fouls and 21 free throws (in about 11
trips), plus 2 timeouts, with 7 undos. Today a 2, a 3 or a foul is two taps (the player's card,
then the play; the popup closes itself after a non-free-throw play). The owner's direction since
2026-11-18: one tap on the card for the common plays, free throws stay in the popup.

Success is two numbers from the Usage CSV taken together: taps per play down, and fixes per game
(undos, edits) not up. On the 2026-11-23 mix, play entry drops from about 123 taps to about 85.

## How we got here

Built as a throwaway spike, tried by the owner on an Android phone, and reviewed twice by several
independent reviewers (round 1: a scorer in the stands, a first-time user, accessibility, visual
design, a mis-tap hunter; round 2: the first four again plus a critic who challenged the whole
approach). Round 2 found no better approach; all said "ship with changes". The spike lives in a
detached worktree at `../bench-book-spike` and on the draft link
`https://spike-tall--quiet-swan-ee2365.netlify.app`. It is a reference for the look, not code to
merge: rebuild it properly with tests.

## Approaches considered

- **A. One-tap buttons on full-width rows (chosen).** About 85 taps for that game's plays. Risk:
  small targets and wrong-row taps; addressed by size, spacing and a confirmation flash.
- **B. Pick a player, then a big play button in a fixed bar.** About 1.8 taps a play, any roster
  size, but no saving on a 2 or a foul over today. Rejected: too little gain.
- **C. Close the popup after a 2, 3 or foul.** Already how the app works (found during the spike).
- Three buttons (+2, +3, F) on the row: tried, felt crowded; +3 moved to the popup (owner).
- Rows sized so 8 fit (48 px, 4 px apart): tried, felt crowded vertically; taller rows chosen.

## Decided by the owner

1. Each player is one full-width row in their team's half, in the existing left/right halves.
   **No names on rows**; everything is by jersey number.
2. Two one-tap buttons per row: **+2** and **Foul**. **+3, free throws, techs, fixes and subs stay
   in the popup**, opened by tapping the number area. The popup itself is unchanged.
3. **Fixed row height whatever the roster size**: rows 56 px tall, 8 px apart (the "taller" spike).
   The list scrolls inside its half. About 5½ rows show on a 390 × 664 iPhone 13 browser, 9 on a
   Pixel 10 Pro; the installed app shows more than the browser.
4. **Activity swap stays** (0.12.2), with the settle time cut from 8 s to **2 s**
   (`SETTLE_MS = 2000`). A play by a player below the top five moves them into it after 2 s with no
   tap anywhere; that half then scrolls back to the top.
5. **Foul dots stay** for 1.1 (a more striking foul display is in the backlog).
6. Buttons: 56 × 52 px, 12 px apart. Feels right to the owner on a Pixel 10 Pro.

## The row

```
┌ Home ─────────────── Team fouls 4 ┐
│ 23   12        [ +2 ]   [ Foul ]  │   56 px row, flat fill, no outline
│ ●●●○○                             │   dots under the number
│ ...                               │
```

- **Number area** (the rest of the width, about 60 px): jersey number 28 px bold; the player's
  points **set apart from the number so the two never read as one figure** (round 2: "#4 0" read as
  "40", and #3 with 0 points as "30", with #30 on screen). Points are smaller, gray (`name` tone
  color), and separated by space or position, for example top-right of the number area or beside
  the dots. Five 8 px foul dots under the number. Tapping anywhere in the number area opens
  today's popup for that player.
- **+2**: filled (Home `bg-slate-200 border-slate-500`; Away `bg-slate-600 border-slate-400`).
- **Foul**: the word, not "F" (my call, 2026-11-24: two first-time reviews read F as "free
  throw"; it fits at 18 px bold in 56 px). Outline style (transparent fill, same border), so it
  differs from +2 by shape, not by a color the color rules reserve for something else.
- **Top five, then the rest**: the rows after the layout's top block take the existing `rest` fill
  (one step toward the half's background), with an extra 8 px gap after the top block.
- **Foul trouble**: at 4 fouls an amber ring (inset, 2 px) and amber dots; on a rest row on the
  light half use amber-700, as the dots already do (`docs/colors.md`: amber-600 on slate-100 is
  2.92:1). **Out**: red ring, the word OUT at 12 px in place of the dots, number area grayed. The
  out row's +2 and Foul keep readable labels but get a dashed border; tapping them opens the
  popup with its existing out warning and records nothing (as tapping an out card does today).
- **Confirmation flash**: a play recorded from a row tints that row's fill for 400 ms; a row the
  activity swap moved tints for 1 s. The flash changes the **fill only**, never the ring, so an
  amber or red ring that appears with the play shows at once (round 2 found the spike's blue ring
  hid the 4th-foul amber). Tint: sky-100 on light, sky-900 on dark. Add this to `docs/colors.md`
  as blue's second job ("a row just recorded or moved").

## The list and the swap

- The list scrolls in its half; the controls under it (+Play, Sub, Tech, timeouts) stay put.
  +Play, Sub and the bench-tech button share one row; the bench-tech button reads **Tech**.
  Timeout buttons are 44 px tall.
- A 16 px fade at the bottom of the list hints that it scrolls. No "N more" counter.
- The swap's wait restarts on any pointerdown **and any scroll** anywhere.
- After a swap, the half scrolls back to the top, **unless the scorer scrolled that list by hand in
  the last 5 s**. With reduced motion set, the scroll jumps instead of animating.
- For 500 ms after a half's displayed order changes (a swap or a sub), taps on that half's row
  buttons are ignored, so a finger already reaching for a row cannot land on the row that slid in.
- The same row button tapped twice within 400 ms records once (a double tap).
- Subs still show at once (the existing `settleKey`), and a sub's layout rules are unchanged.

## First use and help

- The first time a game reaches the live screen on a device, the feedback line shows once:
  "Tap a number for 3s, free throws and fixes." Remember that it was shown (a pref flag).
- The How-to explains the row (+2, Foul, the number for everything else) and the swap; its
  screenshots are regenerated by `pnpm howto:shots`.

## Accessibility

- Row buttons are labeled with team and play: "Home #23, 2 points", "Home #23, foul". The number
  area: "#23, 12 points, 3 fouls, more plays" (", out" when out). Each row is a group labeled
  "Home #23, on floor" or ", bench".
- The feedback line is already a `role="status"` live region. A swap adds its own line there
  ("#32 moved up").
- Every target at least 44 × 44; contrast at least 3:1 for borders and rings on every fill used
  (check the light rest fill and the dark half, both noted by reviewers).

## Not in 1.1

- Names on rows (would cost about two rows of view; an option for later).
- The popup's layout, free-throw flow, the Book, subs and the quarter check: unchanged.
- Backlog, with triggers: a free-throw strip that stays open and closes on the next play (about 11
  taps a game, the popup's Done; changes the owner's "free throws stay a popup" call, so it waits
  for the owner); shorter rows on short screens (trigger: more than 2 scroll-then-tap plays per
  game); padding against Android's back-swipe on the Away half's right edge (trigger: a misfired
  back gesture at a game); logging taps within 1 s of a swap (trigger: an undo right after a swap).

## Settled after the builder check (2026-11-24)

Answered from the code or the conversation, or decided as my calls (marked):

- **Same path as the popup.** A row's +2 and Foul call the same `record()` in `Live.tsx` that the
  popup's buttons call, so the toast, Undo label, foul-out "tell the official" line and bonus text
  are identical. No second recording path. Invariant 1 is tested by comparing the saved event from
  each route.
- **Taps.** Taps are counted by the one capturing click listener in `App.tsx` (any button). A tap
  the double-tap guard or the swap guard ignores still counts as a tap (my call: a tap is what the
  scorer did; the gap between taps and plays is the cost being measured).
- **Top block.** "Top five" means the layout's top block, `layoutFloor` rows, as today (it can be
  other than 5 after a sub). With 5 or fewer players there is no rest section and no extra gap. The
  old 11+ split (floor fixed, bench scrolls) is replaced by the single scrolling list.
- **Swap guard scope** (my call). The 500 ms guard follows an activity swap only, not a sub or an
  Undo (those come from the scorer's own action), and it covers the row's +2 and Foul only; the
  number area always opens the popup.
- **Out rows.** The Foul that makes the 5th foul records; a repeat within 400 ms is a double tap
  and is dropped; any later tap on the out row's +2 or Foul opens the popup with its out warning.
  No special case beyond the double-tap guard.
- **Labels** use Home / Away (`sideName`), as the feedback line does, never the typed team name
  (my call: stable for screen readers and for e2e selectors). The e2e fixture finds a row by
  number; the full-game fixture, How-to shots and UX-audit scenario follow.
- **Release.** 1.0 is cut; this lands on master as 1.1.0 (minor), with a CHANGELOG entry.
- **Colors.** New row styles go into `TONE` in `TeamHalf.tsx`. Contrast is checked by hand and
  recorded in `docs/colors.md`, as the existing light-tone notes are (my call: no automated
  contrast test).

## Invariants

Each is a test in the plan, or marked not checked with the reason.

1. A row's +2 records exactly the event the popup's +2 records for that player (type, side,
   player, period); the same for Foul. One tap, one event.
2. A one-tap play counts once in the Usage CSV's `plays` and once in `taps`.
3. The double-tap guard drops only a repeat of the same side, player and play within 400 ms; a
   different player or play in that window records.
4. Row buttons on an out player never record; they open the popup with the out warning.
5. The display order (swap, scroll, flash) never changes the saved game: the lineup stays
   display-only, as today.
6. With 10 and with 15 players a side on 390 × 664, the controls under the list stay fully in view
   and nothing scrolls horizontally.
7. The tap guard ignores row taps only on the half whose order just changed, only for 500 ms.

## Left to the builder

The exact placement of the points figure within the number area (it must not read as part of
the jersey number; check with screenshots of #3 and #30 together and of a two-digit points total);
component structure; how the e2e fixture finds a player now that rows have no names (by number);
the wording of the How-to text, in the app's existing voice.
