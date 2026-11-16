# Both teams on the live screen (0.8)

Status: design agreed in conversation 2026-11-16; this document awaits the owner's approval.
Mockups were reviewed in the browser (v1 to v5); the final screen is described below in words,
so this document stands without them. A builder check ran on the first draft; its questions are
answered in place (see "Settled after the builder check").

## Why

Most scorers keep both teams. At the owner's games, each team's scorer keeps both. Today the
app records only our team, plus the other team's score as optional team-level taps, so a
both-teams scorer still needs the paper book for the other team. This is the first item on the
1.0 checklist in `CLAUDE.md` ("opponent team stats on the live screen: their fouls (and our
bonus), their timeouts, their points by player number").

The owner chose to record the other team **by jersey number from the start** (rather than
team-level taps first), since there is time and capacity now and nobody but the owner uses the
app yet.

## Goals

- Record the other team play by play, by jersey number, with the same plays as ours: +2, +3,
  FT made, FT missed, Foul, Tech foul, plus their bench techs and their timeouts.
- Both teams on one live screen, each entered the same way: **tap the player, pick the play**.
- Both bonuses: our fouls put them in the bonus, and their fouls put us in it.
- Both teams in the exports and in the quarter check.

## Non-goals (0.8)

- Active lineup and substitutions. That is a separate 1.0 item. Until then, a team with more
  than 10 players scrolls inside its half.
- Reading a roster from a photo of the book (OCR). Recorded in the backlog as "much later":
  handwriting recognition on the phone is a multi-megabyte download and reads poorly.
- The cross-scorer check at halftime and end of game (1.x).
- The Running score page stays ours-only in 0.8 (**builder's call to extend**, see below).

## Anti-goals

It fails, even if it works, if:

- a play lands on the wrong team because the two halves look alike;
- entering a play for **our** team gets slower or moves;
- a game saved before 0.8, or its exports, stops loading or changes meaning;
- a scorer who records nothing for the other team has to do anything extra: leaving their
  roster empty and never tapping their side must just work, check included.

## Decisions (the owner's)

1. **Setup gets a second roster** for the other team: numbers and optional names, entered the
   same way as ours.
2. **The live screen is Home vs Away**, not Us vs Them:
   - **Home** is always on the **left** with **light** cards; **Away** is always on the
     **right** with **dark** cards. (The home team traditionally wears white.)
   - "Us" is only a marker: a small **US** tag on whichever side is ours. It is the only thing
     that changes between a home night and an away night.
   - Each half holds up to **10 player cards (two columns × 5 rows) and a Bench card**.
     Measured on an iPhone 13: about 86 × 82 px a card.
   - Every play, for either team, is tap the player's card, then the same play sheet our
     players use today.
   - The **Opp +1/+2/+3 row is removed** from the bottom bar.
3. **The Bench / coach tech card is half height**, at the foot of each team's half.
4. **Timeout buttons per team, under that team's Bench card**: **Full: 2** and **30s: 1** (with a
   colon), and an **OT: n** button in overtime periods. One tap takes that timeout for that
   team: the count drops and the usual Undo shows. They must look like buttons, with no
   "tap to take" text.
   - The **bottom bar loses its Timeout button**: Undo, Log, End Qn, ⋯. **Log stays in the
     bar.** The owner floated a second Timeout button in Log's place. It was set aside: two
     places for one action is two things to learn, and Log is the mid-game fix route. If a UX
     audit shows the per-team buttons are hard to find, add the bar button then.
5. **A timeout at zero is guarded**, the same way an out player is: the button shows grayed but
   stays tappable, and a tap opens a sheet with a warning, "Away has no full timeouts left. Are
   you sure?", and **Take one anyway**, which records it. Plain wording, matching the
   out-player guard. This replaces today's "using a timeout is never blocked" (the count still
   never goes below zero on screen; a timeout taken anyway shows as used, over the total).
6. **Bonus badges name the team that shoots**: "Home shoots" / "Away shoots", over the half of
   the team that shoots.

7. **One mode: always Home vs Away.** There is no "keep both teams" switch, and the "Also keep
   their score" option goes. Setup always offers the other team's roster, and it may be left
   empty. A scorer who doesn't care about the other team simply never taps their side.
   - Every game, including a one-team game, uses the new layout: our cards in our half, in our
     home or away color, and our timeout buttons under our Bench card.
   - Our team now has half the screen: up to 10 players fit; 11 to 15 scroll inside the half
     until the active lineup (1.0) lands. The owner accepted this gap.
8. **"+ Play" on both halves, and building rosters as you go** (owner, 2026-11-16: first for
   their half, after a side review found their no-number plays hidden behind their Bench card;
   then for ours too, "to circumvent a mis-entered lineup"). **Each** half ends with a dashed
   **+ Play** card, like the Bench card. Tap it, pick the play (+2, +3, FT made, FT missed, Foul,
   Tech foul), then a **Whose number?** prompt: a typed number credits the play and adds that
   player to that team's roster if new; **No number** records it for the team only. The prompt
   also offers **Stop asking this game**, per team and kept on the game, after which that team's
   + Play records team-only plays in two taps. This replaces the Opp +1/+2/+3 taps, and nudges a
   scorer who never entered a roster into building one. A play without a number counts toward
   that team's score, team fouls and bonus, but no player's line. **Both rosters are optional in
   Setup** (our saved roster still prefills ours). Both Bench sheets hold only the bench tech;
   there is no separate Add a player.
9. **The quarter check and their score**: if the scorer types their book total and it differs
   from the app's, the check shows an **amber warning** ("Their score: book 22 · app 20 — 2
   off"). It is a warning only: the quarter's status (matched / fixed / doesn't match), the
   Final screen's open issues and the CSV status still come from **our** score alone. Their box
   left blank skips their side with no warning.
10. **Halftime "fix something"**: the UX audit's scripted game is rewritten for both teams in
    0.8, and at halftime the scorer finds **two** things to fix: a free throw logged as missed
    that was made (a type change in the fix sheet, which exists today) and a foul that was never
    logged. Only the free throw changes the score; the missed foul can be caught only through
    the check's team-fouls count and player fouls list, which is the point. The new both-teams
    e2e game includes the same two fixes.

## Proposals the owner saw and did not correct

- **The strip**: the score and quarter in the middle; each team's team fouls (amber near the
  bonus, as now) and its bonus badge over its own half. Timeouts left move out of the strip,
  since they live on the per-team buttons.
- **Their roster**: numbers required for each row entered, names optional, up to 15, like ours
  (`MAX_PLAYERS`). An empty roster is valid.
- **A number that is not on a roster** (a late arrival, or a mis-entered roster): typed at **Whose
  number?** on that team's + Play (decision 8).
- **Exports**: the Book CSV gets both teams; the Plays CSV marks each play Home or Away.
- **Old saved games keep working**: their opponent points stay team totals (no number).

## Settled after the builder check

- **Timeout totals are unchanged**: 3 full and 2 thirty-second per team, plus one per OT
  period. "Full: 2 · 30s: 1" in the mockups was a mid-game sample of what's left.
- **A game in progress across the update** (games last up to 72 hours) opens in the new layout
  with an empty other-team roster. Its old `OPP_PTS` taps keep counting toward their score, and
  any new points for them go through + Play. No old tap row
  survives in the interface.
- **The Book CSV for a game with nothing recorded for the other team** (empty roster and no
  plays of theirs) is exactly today's layout. A game with any of their plays adds their block.
  The opponent's running score keeps today's rule: blank, not a 0 nobody counted, where the
  scorer recorded none of their points and typed no book total.

## Constraints from the code today

- `GameEvent` (`src/core/types.ts`) has no team field; every event but `OPP_PTS` is ours.
  `OPP_PTS` carries `oppPoints` (1/2/3) with no player.
- `Game.version` is `1`, and `loadGame` rejects anything else. `migrateGame`
  (`src/core/storage.ts`) already upgrades older shapes in place, so new optional fields with
  defaults are the established path.
- `derive` (`src/core/derive.ts`) computes our player lines, our team fouls by period
  (`teamFoulsForBonus` sums Q4 with every OT for the bonus), `oppByPeriod`/`oppTotal` from
  `OPP_PTS`, and `oppInBonus`. The quarter check (`src/core/reconcile.ts`) compares the book's
  opponent total with `oppByPeriod` ("Opponent: book 20 · taps 20").
- The Book CSV (`src/core/export-book.ts`) has one player table and one team-fouls/timeouts
  block; the Plays CSV (`src/core/export-plays.ts`) has a `team` column with `us`/`opp`.
- The out-player rule (`outReason` in `src/ui/live-logic.ts`: 5 fouls or 2 techs) and its guard
  sheet exist for our players.
- Colors have one job each (`README.md` § Colors). Light cards are new: amber and red need
  darker shades on a white card to stay readable (WCAG 3:1 for borders and dots, 4.5:1 for
  text), and the table needs a light-card row.
- Real games run on phones: the e2e suite runs as an iPhone 13 (390 × 664).

## My calls (Claude's), for the owner to check while reading

- **Data shape**: events get an optional `side: 'them'` (absent means ours), so every saved
  event keeps its meaning with no rewrite. The other team's plays reuse the existing event types
  (`FG2`… `TECH`, `BENCH_TECH`, `TIMEOUT`) with `side: 'them'` and a `playerId` from a new
  `Game.oppRoster`. New games never create `OPP_PTS`; old games' `OPP_PTS` still count toward
  their total. Internally it stays us/them; Home/Away is how the screen and exports name the
  sides, from `info.homeAway`. `migrateGame` fills `oppRoster: []`.
- **`trackOpponentTaps` stops driving the interface.** It stays readable on saved games so
  nothing fails to load; the builder decides whether anything still needs it (the Book CSV's
  blank-versus-estimate rule above is now keyed on whether any of their points were recorded).
  The saved preference of the same name is no longer offered.
- **Their roster is not remembered between games** (the opponent changes every game); ours still
  is.
- **The US tag is not blue.** Blue means "the action to take" in the color table, so the tag is a
  neutral label (white or slate outline, "US"). The builder picks the exact look within the
  color table.
- **Plays CSV**: the `team` column keeps `us`/`opp` (existing files and readers stay valid) and a
  new `side` column says `home`/`away`. Legacy `OPP_PTS` rows have an empty number and player.
- **Book CSV**: two team blocks, each headed with the team name and (Home)/(Away), each with its
  player table, team fouls by period, bench techs and timeouts; the score-by-period and reconcile
  sections stay as they are, with the opponent's app total now coming from their numbered plays
  plus any legacy taps.
- **Quarter check**: "Opponent: book 20 · taps 20" becomes the amber warning above when off, and
  "Their score: book 20 · app 20 ✓" when it agrees. The team-fouls count and the "Player fouls,
  whole game" list show both teams whenever the other team has any plays.
- **Bonus wording on screen** follows Home/Away; the strip's existing "Bonus: they shoot FTs"
  wording goes.

## Left to the builder

- Exact card contents at ~86 × 82 px (number, points, foul dots; name truncated or omitted), and
  how the light cards render the 4-foul and out states within the color table.
- The look of the timeout buttons (raised, bordered) and of the zero state.
- Whether the Running score page shows the other team's marks (a non-goal for 0.8; do it only if
  it falls out cheaply).
- How the Log shows which side a play is on (a Home/Away marker per row is enough) and that its
  Fix sheet offers the right team's players.
- Test strategy: every behavior above gets a unit or e2e test. The existing full-game and
  bonus-game e2e tests are updated for the new layout (timeouts move under the Bench card; Opp
  taps become no-number plays) and keep their game and their expected numbers. A new both-teams
  e2e game covers the new path: a timeout at zero, a foul-out on their side, an Add-a-player,
  and the two halftime fixes.
- Rewriting `docs/ux-audit/scenario.md` and its expected end state for both teams (decision 10).
- The How-to page and its screenshots for the new screen.
