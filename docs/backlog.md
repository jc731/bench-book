# Backlog

What might come next for Bench Book, and why. Nothing here has a date. An entry with a
**Trigger** waits for that event before it is designed or built.

The 1.0 checklist lives in `CLAUDE.md`; it is met, and 1.0.0 shipped on 2026-11-24. Anything not
on that checklist goes to 1.x.

## Open: left over from the 1.0 work

These came up while building toward 1.0 and are not done. The `0.9.x` labels are the versions
they were first aimed at.

- **Starters and the lineup: revisit** (owner, 2026-11-19; still torn after the 2026-11-18 game).
  With the floor/bench emphasis gone, an easy way to set starters or rearrange the lineup matters
  more, for example a Starters toggle in team Setup. The owner hasn't settled what the lineup should
  do. Trigger: the owner settles what the lineup should do; then design it again with mockups,
  reviewed by the same group. Design the cards with room for 1.1's one-tap buttons, so the cards
  aren't redone twice.
  - Audit v0.11.0 (2026-11-20, F1): a first-timer did not see the one-shade floor/bench cue.
- **0.9.x: a line-change view** for several subs at once, including several missed ones: move or
  swap multiple players between floor and bench in one place (drag and drop, or a tap-to-swap).
  Design note: the 0.9 critics rejected drag for single subs (hard to discover, and it fights the
  bench's scrolling), and "Who's on the floor?" already toggles several players at once, so the
  design should start from what a real game shows that sheet missing.
- **0.9.x: from the 0.9.0 audit and persona reviews** (2026-11-17; check against tonight's game):
  - Cards regroup after every sub (three reviewers): the incoming player could take the outgoing
    player's slot instead.
  - "Who's on the floor?": a tapped player stays under the old heading (audit F3, first-timer).
  - A sub that belongs to an earlier quarter has no home: adding a missed foul from the check puts
    the player on the floor now (audit F1). The check's Add play could ask who went out.
    Audit v0.11.0 (2026-11-20, F2): 0.11 no longer promotes, but the Q2 sub went in as a Q3 one.
  - A new opposing player can only be added after picking a play (audit F2).
    Audit v0.11.0 (2026-11-20, F4): same order again, milder ("a small difference").
  - With 11+ players, nothing hints that the bench scrolls; cut-off cards look like a glitch.
  - "Stop asking this game" sits beside No number and can only be undone right away.
  - Explain the bonus and amber team fouls in the How-to; say the first five start on Setup;
    "Full: 3" doesn't say left or used; two Save buttons on the check with a play open.
  - Plays CSV for spreadsheets: #0 and #00 merge in Excel; no date/opponent columns; explain `*`.
  - Accessibility (brighter solid-card borders done in 0.9.2): "pressed" rows in Who went out?
    read wrong to a screen reader; 40 px timeout buttons; larger phone text pushes timeouts
    below the fold.

## After 1.0 (1.x)

- **1.1: efficiency (UI refinement).** Measure taps and fixes per play, then cut them. Direction
  (owner, 2026-11-18): one tap on a card for +2, +3 and Foul; free throws stay a popup.
  - First real game on 0.9 (2026-11-17, both teams, OT, a foul-out, no techs or bonus; the CSV
    stays out of the repo because it has real names): 68 entries, of which 19 2's, 18 fouls,
    13 FT made, 9 FT missed, 6 3's and 3 timeouts. About 1.96 taps per entry today; with one-tap
    2/3/Foul and FTs unchanged, about 1.3 (43 of 68 become one tap).
  - Target: the owner's 1.25–1.5 is an arbitrary number. Track two numbers together: taps per
    entry on a real game's mix, and fixes per game (undos, Book edits, late catch-up entries), so a
    faster card that causes more mis-taps doesn't count as a win.
  - Data points from that game, not bugs: free throws come when subs are busiest, so a pair often
    gets broken up (close the sheet, record the sub, come back), and one pair landed on two
    players; missed free throws were caught up in a burst later. The owner's attention fades late in
    each half (a 5th foul for one player is missing from the log, likely in Q2 or Q4). The player
    stats page and the quarter check are where these get caught.
  - Today's cards are about 88 px wide and 60 px tall at 390 px (computed from the layout,
    2026-11-18), so three 44 px one-tap buttons (+2, +3, Foul) don't fit on a card. 1.1 needs its
    own layout decision.
  - Owner's candidate layout (2026-11-23, tabled): one full-width card per row in each half, a
    little taller, leaving room for +2, +3, Foul and maybe FT made/missed on the card. Check
    against 10 a side with no scroll at 390 × 664 before building.
  - Activity swap (0.12.2): the owner finds 8 s (`SETTLE_MS`) long and suggests 2–3 s; left at 8
    until after 1.0 (owner, 2026-11-23). Also for later: animate the two cards trading places.
  - Tap volume still felt high at the 2026-11-18 game (owner); 0.10's Usage CSV gives the baseline.
  - Still useful before designing: 30–40 real play-by-plays (high school or junior high) for the
    play mix, so the design isn't fitted to one game.
- **Card order: an option to keep cards sorted by jersey number** (owner, 2026-11-24). Subs
  continue to prove optional: the 2026-11-23 game recorded none. A customization setting, next to
  "Our team on the left", choosing between the activity swap and a fixed number order. Trigger:
  the 1.1 card layout, since full-width cards change what ordering is for.
- **Small safety nets** (owner, 2026-11-23, from audit v0.11.0: "prob should add"):
  - A warning when a play is credited to a bench player. Today it is taken silently and the
    player goes on the floor (audit F5: the scripted slip at event 20, caught only by the
    confirmation line). 0.10 removed "now on the floor" on purpose, so word this as a check on
    the slip, not the old lineup prompt.
  - A confirm when ending Q1 to Q3, which take one tap today (audits v0.6.0, v0.9.0, v0.11.0 F6;
    no quarter has been ended by mistake yet). It adds a tap at every quarter end, so weigh it
    against 1.1's tap counts. Ending Q4 already asks overtime or end game.
- **Maybe: nudges when something happens**, e.g. a foul while the other team is in the bonus
  suggests free throws for the fouled team. Only as a way to make things better, not a rule engine.
- Cross-scorer check at halftime and end of game: compare what you recorded with the other
  team's scorer and talk through any difference.
- Tablet-size release test.
- Notifications: alerts for timeouts remaining, a player in foul trouble or fouled out, the team
  fouls reaching the bonus, and so on. Open question for the design: on-device alerts for the
  scorer, or push notifications to other people's phones (a coach, a parent), which would need
  a server the app doesn't have today.
- Share: post the score, or the stats after the game, to social media, so a team can send results
  out from the app (the phone's share sheet, with a text or image summary).

- **Export without names** (owner, 2026-11-24): a choice on the export screen that writes the Book
  and Plays CSVs with the name column blank (numbers only), so a scorer can attach one to a bug
  report or share it publicly. Until then, the issue form asks for no names and accepts the Usage
  CSV, which has none.

- **A more striking foul count per player** (owner, 2026-11-24, while trying the 1.1 rows): the
  five foul dots work but are small. Explore something more obvious at a glance, for example the
  row's background filling in step by step with each foul, or another visual cue. Leave the dots
  alone for 1.1 ("it's solid"). Trigger: after 1.1 ships, or a real game where a foul count was
  misread.

## After 1.1: from the one-tap rows design (2026-11-24)

Left out of 1.1 on purpose; each waits for its trigger.

- **A free-throw strip** that stays open and closes on the next play (about 11 taps a game, the
  popup's Done). It changes the owner's "free throws stay a popup" call, so it waits for the owner.
  Trigger: the owner reopens that call, or the Usage CSV shows free throws as the biggest tap cost.
- **Shorter rows on short screens.** Rows stay 56 px whatever the roster. Trigger: more than 2
  scroll-then-tap plays per game in the Usage CSV.
- **Padding against Android's back-swipe** on the Away half's right edge, where +2 and Foul sit.
  Trigger: a misfired back gesture at a game.
- **Log taps within 1 s of a swap**, ignored or not, to see the guard's cost. Trigger: an undo
  right after a swap.
- **Names on rows** as an option (about two rows of view lost). Trigger: a scorer who cannot
  work from numbers alone.

## Recorded, not planned

- The quarter check compares team fouls too. Trigger: a second real game with a missed foul.
- Merge a stray number into the real player in Edit teams. Trigger: a stray number with more than
  about 2 plays.
- The Book CSV marks no foul-out, and that is fine (owner, 2026-11-23): the row's 5 fouls say it,
  and a reader can assume the rest. Raised by audits v0.6.0, v0.9.0 and v0.11.0 F8; don't
  re-raise it while the row shows the 5 fouls. Trigger: a scorer or the book needing the
  foul-out quarter from the file.

## Much later

- Read a roster from a photo of the book (OCR). Handwriting recognition on the phone is a
  multi-megabyte download and reads poorly.

## Done

Kept for the record of what was asked and what shipped.

- **Timeout clock: buzz and auto-close** (owner, 2026-11-24). Done in 1.0.1: a buzz at the
  warning point and at 0, and the clock closes 10 s after 0. Android only: iPhone has no
  Vibration API for web apps, and the owner wants no beep instead (2026-11-24).
- **For 1.0 (the checklist in `CLAUDE.md`):**
  - ~~Opponent team stats on the live screen: their fouls (and so our bonus), their timeouts,
    their points by player number.~~ Done in 0.8: both teams on one screen, by number, in both
    CSVs and in the quarter check.
  - ~~**0.9: active lineup with substitutions.** The five on the floor sit at the top of their half
    and the bench below. A sub moves players between floor and bench, and nothing is hidden, so
    subbing is optional and a missed sub costs nothing. A fouled-out player prompts a sub.~~ Done
    in 0.9: floor solid and bench ghosted, a Sub button per team, the sub sheet's three questions,
    60 px cards so 10 players a half still fit an iPhone 13, and with 11 or more the floor stays in
    view while only the bench scrolls. Design:
    `docs/superpowers/specs/2026-11-17-active-lineup-design.md`.
  - ~~**1.0: a player stats page** (on the checklist, 2026-11-18): each player's points and fouls by
    quarter, for both teams, and a quick way to add or fix a play for a given quarter, mid-game or at
    the quarter's end.~~ Done in 0.11: Log became Book, with a Players tab (points and fouls by
    quarter for Home or Away, with Team and Score rows) and a Plays tab (the old Log). Tapping a
    quarter cell lists that player's plays there, one tap from the fix sheet, and adds a missing play
    to that quarter. A play added or re-credited after its quarter never moves anyone onto the floor.
    Later stats (rebounds, assists) would live here. Design:
    `docs/superpowers/specs/2026-11-19-player-stats-design.md`.
  - ~~**Before 1.0: back toward neutral cards** (owner, 2026-11-18, after the first real game on 0.9).~~
    Done in 0.10: the cards look the same on the floor and the bench (no ghosted bench, no "bench"
    tag, no amber Sub prompt), and the cards after the top five are one shade grayer (Home) or darker
    (Away). The top five still sit at the top of each half.
