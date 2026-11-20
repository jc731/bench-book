# Bench Book

A free, open-source web app for the person keeping the scorebook at a junior high
basketball game. Tap in both teams' points, fouls and timeouts as they happen (or just your
own), reconcile against the paper book at the end of each quarter, and export CSVs that pair
with the book page after the game.

- No login, no server. Everything stays on your device.
- Works offline once loaded. On iPhone/iPad, use **Add to Home Screen**.
- Rules: IESA / NFHS (team fouls reset each quarter, bonus on the 5th).

## How a game works

1. **Setup.** Pick Home or Away and enter your roster (number and name), and the other team's
   roster under it (numbers, names optional) if you keep both teams. Both rosters are optional.
   Tap **Start game**. **Game details** holds the opponent (left blank, the game is named for its
   date, MM-DD), the date, your team name, the coach, scorer and timekeeper. Your roster is saved
   on the device for next time; theirs is not.
2. **Live.** Home is on the left with light cards, Away on the right with dark ones, and a small
   **US** tag marks your team. Tap any player card on either team, then `+2`, `+3`, `FT made`,
   `FT missed`, `Foul` or `Tech foul`. Each half ends with a dashed **+ Play** card for a play
   with no card: pick the play, then **Whose number?** credits a typed number (adding a new one to
   that team), or **No number** records it for the team only. Under it are the team's **Bench /
   coach tech** card and its timeout buttons (`Full: 3`, `30s: 2`, plus `OT` in overtime), each
   showing what is left; one at zero asks first. **Undo**, **Book**, **End Q** and **⋯** are on
   the bottom bar. One line above the bar shows what was just entered, naming the team, and stays
   until the next entry, with a chip at its right for a quarter still to check.
3. **Subs (optional).** Every card looks the same; the five on the floor lead, and the cards after
   them are a shade grayer (Home) or darker (Away). Each team's first five start (the **Starters** button, beside + Play, changes
   them before that team's first play). A bench player who makes a play goes on the floor on
   their own, so nothing is lost by skipping a sub, and a foul-out takes the player off. For a sub,
   tap the player checking in, then **#22 checks in** on their sheet, then who went out. The **Sub**
   button (always gray) asks **Who went out?** (with a quiet
   "longest without a play" hint), **Who came in?** or, for a line change, **Who's on the floor?**. Subs change no score
   or count and are in neither CSV.
4. **Fix mistakes.** Undo right away (Redo puts back one undone too many), or open **Book**, then
   **Plays** and tap a row: it opens the fix, where you change the play, the team, the player or the quarter,
   or delete it. **Book → Players** shows each player's points and fouls by quarter, for either team,
   like the book's rows; tap a quarter cell to list that player's plays there, fix one, or add a
   missing play to that quarter (a 5th foul added late says Tell the official).
5. **Check each quarter.** **End Q1** advances at once. When there is time, tap the check chip,
   enter the game score after the quarter from the book's running score, and the app checks the
   quarter's own points against its plays. Their score, if you type it, only warns when it is
   off. **Add play** stays on the check after the score matches, for a foul the book has and the
   app doesn't. You can leave the check for later.
6. **Final.** After Q4, choose Start overtime or End game (no overtime). The **Final** screen
   lists any quarter not yet checked, ends a game early with a confirm, and **Reopen game** puts
   an ended game back in play.
7. **Export.** From Final, download the Book CSV (pairs with the paper book page, with a block
   for each team you recorded; plays with no number get a "No number" row, so each block adds
   up) and the Plays CSV (every entry, in order, each marked Home or
   Away).

**How to use**, under the ⋯ button, explains all of this in the app, with screenshots.

**Demo mode.** Add `?demo` to the address to open Setup with both rosters filled with invented
players, for trying the app or showing it off. Demo keeps its own saved game and rosters, so a
real roster or game on that phone is never touched; a gray **Demo** strip shows at the top, and
⋯ > **Reset demo** starts it over.

Rules: IESA / NFHS. Game data is purged 72 hours after the last change; the saved roster is kept.

## Privacy

Nothing leaves the device. There is no server, no account, no analytics and no third-party
scripts or fonts. Roster names and game data live in the browser's local storage only.

## Development

```bash
pnpm install
pnpm dev        # dev server
pnpm dev:demo   # dev server opened at /?demo: both rosters filled with invented players, in demo's own storage
pnpm build      # static build to dist/
pnpm preview    # serve the built site
pnpm test       # unit tests (vitest)
pnpm test:e2e   # scripted games in a real browser (Playwright, iPhone 13 profile); the bonus game prints taps per quarter
pnpm check      # the gate: astro check, tsc, unit tests
pnpm howto:shots # refresh the How-to screenshots in public/howto/ (pnpm release runs it)
```

The first `pnpm test:e2e` run needs the browser once: `pnpm exec playwright install chromium`.

## Colors

Each color has one job, so a color on screen says what kind of thing it is. Keep to these
when adding to the interface:

| Color | Means | Examples |
|---|---|---|
| **Amber** | Caution: something to look at, never "tap here" | a player at 4 fouls, the bonus, team fouls near the bonus, bench techs, a check that doesn't match (and the Book cell sheet's "check now 2 over" line), a file not saved yet, Not saving, the timeout clock's last half |
| **Red** | Out, or ends something for good | an out player (and the Book cell sheet's out line), End Q4 / OT (can end the game), Discard when the game is not exported, the timeout clock's Time |
| **Blue** (`sky`) | The action to take, links, selection, focus | End Q1–Q3, Check, Undo, Redo, Home/Away chosen (Setup, Book), the Book tab chosen, focused fields |
| **White fill** | The main button of a screen or sheet | Start game, Save, Done, Book CSV, Plays CSV |
| **Green** | Done and fine | Matched, Fixed, saved files |
| **Gray** (`slate`) | Everything else: data, ordinary buttons, neutral state | the cards (one style, outlines slate-600 on Home and slate-400 on Away; the cards after the top five are one fill step closer to the half's background: grayer on Home (slate-100 on white), darker on Away), the Sub button, the sub sheet's "just in" tag and "longest without a play" hint, the Demo strip, a player's first three fouls, the bar |

Home cards are light (white) and Away cards dark, so the state colors have two sets of shades,
each kept at 3:1 or better for borders and dots and 4.5:1 for text:

| Card | Warn border and dots (4 fouls; Bench card with techs) | Out | Warn text (team fouls near the bonus, tech count) |
|---|---|---|---|
| Dark (Away) | amber-400 | red-500 border and dots, red-400 OUT | amber-300 |
| Light (Home) | amber-600 (amber-700 on the cards after the top five and on the Bench card: amber-600 measured 2.92:1 on slate-100) | red-600 border, dots and OUT | amber-800 |

A warned card's number, name and points keep the card's ordinary text color (slate-900 on a
light card, white on a dark one); only its border and dots turn amber.

A status shown on a button (the amber check chip for a quarter that doesn't match) is still a
state color: the color says what is true, and the button shape says it can be tapped.

## Releases

Changes are listed in [`CHANGELOG.md`](CHANGELOG.md). A release is cut with
`pnpm release <patch|minor|major>`, which never pushes.

## Backlog

**For 1.0** (the checklist in `CLAUDE.md`):

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
- ~~**1.0: a player stats page**~~ (done in 0.11; on the checklist, 2026-11-18): each player's points and fouls by
  quarter, for both teams, and a quick way to add or fix a play for a given quarter, mid-game or at
  the quarter's end. Design first (options, critique, mockups), as for 0.9. Later stats (rebounds,
  assists) would live here.
- ~~**Before 1.0: back toward neutral cards** (owner, 2026-11-18, after the first real game on 0.9).~~
  Done in 0.10: the cards look the same on the floor and the bench (no ghosted bench, no "bench"
  tag, no amber Sub prompt), and the cards after the top five are one shade grayer (Home) or darker
  (Away). The top five still sit at the top of each half.
- **Starters and the lineup: revisit** (owner, 2026-11-19; still torn after the 2026-11-18 game).
  With the floor/bench emphasis gone, an easy way to set starters or rearrange the lineup matters
  more, for example a Starters toggle in team Setup. The owner hasn't settled what the lineup should
  do. Trigger: the owner settles what the lineup should do; then design it again with mockups,
  reviewed by the same group. Design the cards with room for 1.1's one-tap buttons, so the cards
  aren't redone twice.
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
  - A new opposing player can only be added after picking a play (audit F2).
  - With 11+ players, nothing hints that the bench scrolls; cut-off cards look like a glitch.
  - "Stop asking this game" sits beside No number and can only be undone right away.
  - Explain the bonus and amber team fouls in the How-to; say the first five start on Setup;
    "Full: 3" doesn't say left or used; two Save buttons on the check with a play open.
  - Plays CSV for spreadsheets: #0 and #00 merge in Excel; no date/opponent columns; explain `*`.
  - Accessibility (brighter solid-card borders done in 0.9.2): "pressed" rows in Who went out?
    read wrong to a screen reader; 40 px timeout buttons; larger phone text pushes timeouts
    below the fold.

**After 1.0 (1.x):**

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
  - Tap volume still felt high at the 2026-11-18 game (owner); 0.10's Usage CSV gives the baseline.
  - Still useful before designing: 30–40 real play-by-plays (high school or junior high) for the
    play mix, so the design isn't fitted to one game.
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

**Recorded, not planned:**

- The quarter check compares team fouls too. Trigger: a second real game with a missed foul.
- Merge a stray number into the real player in Edit teams. Trigger: a stray number with more than
  about 2 plays.

**Much later:**

- Read a roster from a photo of the book (OCR). Handwriting recognition on the phone is a
  multi-megabyte download and reads poorly.

## Deploy

Connect the repo in Netlify (build `pnpm build`, publish `dist`).

Design: [`docs/superpowers/specs/2026-11-10-bench-book-v1-design.md`](docs/superpowers/specs/2026-11-10-bench-book-v1-design.md).

Licensed under [MIT](LICENSE).
